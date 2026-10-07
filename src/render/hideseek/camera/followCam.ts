import type * as THREE from 'three';
import { angleDelta } from '@/engine/core/math';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { stepSpring } from '@/render/shared/interpolate';
import type { Flight, Orbit } from './flight';
import { CLOSE_AZIMUTH, orbitShot } from './framing';
import { clearView, sightBlocked, type ViewAngle } from './occlusion';

/**
 * The follow shot: a drone a few meters off the agent's shoulder, high
 * enough to see over a wall, aimed at its chest. Stiffness (1/s) sets how
 * closely the aim trails a running agent: soft enough to feel like a
 * camera operator, firm enough that a sprint never leaves the frame.
 */
export const FOLLOW = { distance: 9.5, elevation: (57 * Math.PI) / 180, height: 0.7, stiffness: 5 };

const WALL = DEFAULT_HIDESEEK_PHYSICS.arena.wallHeight;
/** The point on the agent the camera must see, m over its feet: the middle of its head. */
const SIGHT = 1.05;
/** Once swinging, the sight line must pass this far over the walls before the camera stops, m, so it never stops on an edge. */
const CLEARANCE = 0.45;
/** Seconds a view stays blocked before the camera swings, so a wall the agent runs past does not move it. */
const PATIENCE = 0.2;
/** Seconds after you let go of the orbit before the camera may swing by itself. */
const HANDS_OFF = 0.8;
/** How fast the camera swings round to a clear side, 1/s. */
const SWING = 2.6;
/** An aim this far from its agent means the agent jumped (a new round, a respawn), m: the camera flies there instead of trailing. */
const RESPAWN = 4;

/** The followed agent this frame, in world space, and what it stands among. */
export interface FollowTarget {
  /** Shot key: a new one flies to a fresh follow shot. */
  key: number;
  x: number;
  z: number;
  /** Height of its feet over the floor, m. */
  elevation: number;
  /** World position of its arena's center, to test the walls in the arena's own coordinates. */
  ox: number;
  oz: number;
  /** Changes with every new round, which puts the agent back at its spawn. */
  epoch: number;
  walls: readonly Rect[];
}

/**
 * The follow views. The aim trails the agent on a critically damped
 * spring stepped in simulation time, so it keeps up at a fast watch speed;
 * camera and aim move together, so the angle and distance you orbit to
 * are kept. When a wall hides the agent for a moment, the camera swings
 * round it, or up over a narrow corridor, to the nearest clear view. A
 * new round flies straight to the agent. Allocates nothing per frame.
 */
export class FollowCam {
  /** Set while you drag the orbit: the camera never swings out of your hands. */
  dragging = false;
  private readonly aim = { x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 }, z: { value: 0, velocity: 0 } };
  private readonly offset = { x: 0, y: 0, z: 0 };
  private readonly view: ViewAngle = { azimuth: CLOSE_AZIMUTH, elevation: FOLLOW.elevation };
  private readonly goal: ViewAngle = { azimuth: 0, elevation: 0 };
  private epoch = Number.NaN;
  private blockedFor = 0;
  private sinceDrag = HANDS_OFF;
  private swinging = false;

  /** Moves the camera for one frame of `dt` wall seconds while the simulation runs `timeScale` times faster. */
  update(camera: THREE.Camera, c: Orbit, f: Flight, t: FollowTarget, dt: number, timeScale: number): void {
    const ax = t.x;
    const ay = FOLLOW.height + t.elevation * 0.8;
    const az = t.z;
    const o = this.offset;
    if (t.key !== f.key) {
      f.key = t.key;
      this.epoch = t.epoch;
      this.view.azimuth = CLOSE_AZIMUTH;
      this.view.elevation = FOLLOW.elevation;
      this.flyTo(camera, c, f, t, FOLLOW.distance);
    } else if (f.t >= 1 && (t.epoch !== this.epoch || Math.hypot(ax - this.aim.x.value, az - this.aim.z.value) > RESPAWN)) {
      // The agent jumped: fly over to it, keeping the angle and distance you had unless a wall there hides it.
      this.epoch = t.epoch;
      this.readView(camera, c);
      this.flyTo(camera, c, f, t, camera.position.distanceTo(c.target));
    }
    if (f.t < 1) {
      // Mid flight the destination moves with the agent, and the aim waits there for the flight to land.
      f.toTarget.set(ax, ay, az);
      f.toPos.set(ax + o.x, ay + o.y, az + o.z);
      this.settleAim(ax, ay, az);
      return;
    }
    const sim = dt * timeScale;
    const nx = stepSpring(this.aim.x, ax, FOLLOW.stiffness, sim);
    const ny = stepSpring(this.aim.y, ay, FOLLOW.stiffness, sim);
    const nz = stepSpring(this.aim.z, az, FOLLOW.stiffness, sim);
    f.carry(camera, c, nx - c.target.x, ny - c.target.y, nz - c.target.z);
    this.avoidWalls(camera, c, t, dt);
  }

  /** Starts a flight to the agent from this.view at `distance`, turned to a clear side first if a wall hides it there. */
  private flyTo(camera: THREE.Camera, c: Orbit, f: Flight, t: FollowTarget, distance: number): void {
    const ay = FOLLOW.height + t.elevation * 0.8;
    if (clearView(t.x - t.ox, t.elevation + SIGHT, t.z - t.oz, distance, this.view, t.walls, WALL + CLEARANCE, this.goal)) {
      this.view.azimuth = this.goal.azimuth;
      this.view.elevation = this.goal.elevation;
    }
    const shot = orbitShot(t.x, t.z, distance, this.view.elevation, this.view.azimuth, ay);
    this.offset.x = shot.px - t.x;
    this.offset.y = shot.py - ay;
    this.offset.z = shot.pz - t.z;
    f.start(camera, c, shot);
  }

  /** this.view from where the camera sits round its aim now. */
  private readView(camera: THREE.Camera, c: Orbit): void {
    const dx = camera.position.x - c.target.x;
    const dy = camera.position.y - c.target.y;
    const dz = camera.position.z - c.target.z;
    this.view.azimuth = Math.atan2(dx, dz);
    this.view.elevation = Math.atan2(dy, Math.hypot(dx, dz));
  }

  private settleAim(x: number, y: number, z: number): void {
    const a = this.aim;
    a.x.value = x;
    a.y.value = y;
    a.z.value = z;
    a.x.velocity = a.y.velocity = a.z.velocity = 0;
  }

  /** Swings the camera round a wall that has hidden the agent for a moment, unless you have the orbit in hand. */
  private avoidWalls(camera: THREE.Camera, c: Orbit, t: FollowTarget, dt: number): void {
    if (this.dragging) {
      this.sinceDrag = 0;
      this.blockedFor = 0;
      this.swinging = false;
      return;
    }
    this.sinceDrag += dt;
    const p = camera.position;
    const hx = t.x - t.ox;
    const hy = t.elevation + SIGHT;
    const hz = t.z - t.oz;
    const blocked = sightBlocked(hx, hy, hz, p.x - t.ox, p.y, p.z - t.oz, t.walls, WALL + (this.swinging ? CLEARANCE : 0));
    this.blockedFor = blocked ? this.blockedFor + dt : 0;
    if (!blocked) this.swinging = false;
    if (!blocked || this.blockedFor < PATIENCE || this.sinceDrag < HANDS_OFF) return;
    this.readView(camera, c);
    const distance = p.distanceTo(c.target);
    if (!clearView(hx, hy, hz, distance, this.view, t.walls, WALL + CLEARANCE, this.goal)) return;
    this.swinging = true;
    const k = 1 - Math.exp(-SWING * dt);
    const azimuth = this.view.azimuth + angleDelta(this.view.azimuth, this.goal.azimuth) * k;
    const elevation = this.view.elevation + (this.goal.elevation - this.view.elevation) * k;
    const flat = Math.cos(elevation) * distance;
    p.set(c.target.x + Math.sin(azimuth) * flat, c.target.y + Math.sin(elevation) * distance, c.target.z + Math.cos(azimuth) * flat);
    camera.lookAt(c.target);
  }
}
