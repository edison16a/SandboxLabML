import type * as THREE from 'three';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { stepSpring, type Spring } from '@/render/shared/interpolate';
import { actionBox, leadPlayer, type ActionPlayer, type FloorBox } from './actionBox';
import { fitClearOf, type Cover, type ScreenWindow, type WindowFit } from './fit';
import type { Flight, Orbit } from './flight';
import { CLOSE_AZIMUTH, orbitShot } from './framing';
import type { ViewAngle } from './occlusion';
import { WallDodge, type RoomPoint } from './wallDodge';

/**
 * The Close view's angle: about 40 degrees up, the angle of a sports
 * broadcast, low enough to see faces and the sides of crates, high enough
 * to see over most inner walls. Turned off the room's axis so walls read
 * as solid.
 */
export const ACTION_ELEVATION = (40 * Math.PI) / 180;
/** Where the action may sit on screen: the full width, below the row of HUD chips along the top and above the picture in picture strip along the bottom. */
const ACTION_FILL: ScreenWindow = { h: 0.97, up: 0.84, down: 0.6 };
/** Height the shot keeps in frame over the floor, m: a player standing on a crate. */
const ACTION_HEIGHT = 2.2;
/** The middle of a player's head over its feet, m: what must stay in sight. */
const HEAD = 1.05;
/** How fast the aim and the distance follow the play, 1/s of simulation time: a steady operator, not a twitchy one. */
const STIFFNESS = 2.2;
/** Seconds after you let go of the orbit before the shot reframes by itself. */
const HANDS_OFF = 0.8;
/** Most players the shot tries to keep out from behind walls: the lead and a few framed with it. */
const IN_SIGHT = 4;
/** How far a hand zoom may push the shot in or out of its framing. */
const ZOOM_MIN = 0.35;
const ZOOM_MAX = 3;

/** One room this frame: its players (the first `count`) and walls, in its own coordinates, and where it sits in the world. */
export interface ActionRoom {
  agents: readonly ActionPlayer[];
  count: number;
  walls: readonly Rect[];
  /** Half the room's size, walls included, m. */
  half: number;
  ox: number;
  oz: number;
}

const spring = (): Spring => ({ value: 0, velocity: 0 });

/**
 * The Close view: a three quarter action shot that frames the players
 * with a margin of floor (see actionBox), kept inside the room, and
 * follows the play on critically damped springs. When a wall hides a
 * framed player, the view turns or climbs to see it (see WallDodge). Orbit
 * and zoom stay yours: the angle is whatever you leave it at, and a zoom
 * is kept as a share of the framing, so the shot still breathes with the
 * play. A new room or view flies in with the shared Flight. Allocates
 * nothing per frame.
 */
export class ActionCam {
  /** Set while you drag the orbit, so the shot never fights your hands. */
  dragging = false;
  private sinceDrag = HANDS_OFF;
  private zoom = 1;
  /** The elevation the view settles back to after climbing over a wall: the default, or the one you orbited to. */
  private rest = ACTION_ELEVATION;
  private readonly x = spring();
  private readonly z = spring();
  private readonly distance = spring();
  private readonly box: FloorBox = { x: 0, z: 0, w: 0, d: 0 };
  private readonly fit: WindowFit = { distance: 0, shift: 0, lateral: 0 };
  private readonly view: ViewAngle = { azimuth: CLOSE_AZIMUTH, elevation: ACTION_ELEVATION };
  private readonly goal = { x: 0, z: 0 };
  private readonly dodge = new WallDodge();
  private readonly eye: RoomPoint = { x: 0, y: 0, z: 0 };
  private readonly heads: RoomPoint[] = Array.from({ length: IN_SIGHT }, () => ({ x: 0, y: 0, z: 0 }));
  private readonly aim: RoomPoint = { x: 0, y: 0, z: 0 };

  /** Moves the camera for one frame of `dt` wall seconds while the simulation runs `timeScale` times faster. */
  update(camera: THREE.PerspectiveCamera, c: Orbit, f: Flight, key: number, room: ActionRoom, cover: Cover, aspect: number, dt: number, timeScale: number): void {
    if (key !== f.key || f.t < 1) {
      if (key !== f.key) {
        f.key = key;
        this.zoom = 1;
        this.rest = this.view.elevation = ACTION_ELEVATION;
        this.view.azimuth = CLOSE_AZIMUTH;
        this.dodge.reset();
      }
      // A flight starts on a new shot; mid flight its destination moves with the play, and the springs wait there for it to land.
      this.frame(camera, room, cover, aspect);
      const shot = orbitShot(this.goal.x, this.goal.z, this.fit.distance, this.view.elevation, this.view.azimuth);
      if (f.key === key && f.t >= 1) f.start(camera, c, shot);
      else {
        f.toTarget.set(shot.tx, shot.ty, shot.tz);
        f.toPos.set(shot.px, shot.py, shot.pz);
      }
      this.settle();
      return;
    }
    this.readView(camera, c);
    const now = camera.position.distanceTo(c.target);
    if (this.dragging) this.sinceDrag = 0;
    else this.sinceDrag += dt;
    const hands = this.sinceDrag < HANDS_OFF;
    if (hands) {
      this.rest = this.view.elevation;
      this.dodge.reset();
    } else this.keepPlayersInSight(camera, c, room, now, dt);
    this.frame(camera, room, cover, aspect);
    if (hands) {
      // Your zoom is kept as a share of the framing, and the distance spring rests where you put it.
      this.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, now / this.fit.distance));
      this.distance.value = now;
      this.distance.velocity = 0;
    }
    const sim = dt * timeScale;
    const tx = stepSpring(this.x, this.goal.x, STIFFNESS, sim);
    const tz = stepSpring(this.z, this.goal.z, STIFFNESS, sim);
    const d = hands ? now : stepSpring(this.distance, this.fit.distance * this.zoom, STIFFNESS, sim);
    const flat = Math.cos(this.view.elevation) * d;
    c.target.set(tx, 0, tz);
    camera.position.set(tx + Math.sin(this.view.azimuth) * flat, Math.sin(this.view.elevation) * d, tz + Math.cos(this.view.azimuth) * flat);
    camera.lookAt(c.target);
  }

  /**
   * Turns this.view toward a clear sight of the players in the shot when a
   * wall hides one, the lead first, in the room's own coordinates. Uses the
   * box framed last frame, which the springs keep close to this one.
   */
  private keepPlayersInSight(camera: THREE.Camera, c: Orbit, room: ActionRoom, distance: number, dt: number): void {
    const lead = leadPlayer(room.agents, room.count);
    if (lead < 0) return;
    const b = this.box;
    let count = 0;
    for (let k = -1; k < room.count && count < IN_SIGHT; k++) {
      // The lead goes first, then every other player inside the framed box.
      const i = k < 0 ? lead : k;
      if (k >= 0 && i === lead) continue;
      const p = room.agents[i];
      if (k >= 0 && (Math.abs(p.x - b.x) > b.w / 2 || Math.abs(p.z - b.z) > b.d / 2)) continue;
      const h = this.heads[count++];
      h.x = p.x;
      h.y = p.elevation + HEAD;
      h.z = p.z;
    }
    this.eye.x = camera.position.x - room.ox;
    this.eye.y = camera.position.y;
    this.eye.z = camera.position.z - room.oz;
    this.aim.x = c.target.x - room.ox;
    this.aim.y = c.target.y;
    this.aim.z = c.target.z - room.oz;
    this.dodge.update(this.view, this.eye, this.heads, count, this.aim, distance, this.rest, room.walls, dt);
  }

  /** Frames the room's action from this.view into this.fit and this.goal, the aim in world space. */
  private frame(camera: THREE.PerspectiveCamera, room: ActionRoom, cover: Cover, aspect: number): void {
    const b = actionBox(room.agents, room.count, room.half, this.box);
    const a = this.view.azimuth;
    fitClearOf(b.w, b.d, ACTION_HEIGHT, camera.fov, aspect, this.view.elevation, a, ACTION_FILL, cover, this.fit);
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    // The aim moves toward the camera by `shift` and to its right by `lateral` (see fitClearOf).
    this.goal.x = room.ox + b.x + sa * this.fit.shift + ca * this.fit.lateral;
    this.goal.z = room.oz + b.z + ca * this.fit.shift - sa * this.fit.lateral;
  }

  /** Puts the springs at rest on the goal, for when a flight hands over. */
  private settle(): void {
    this.x.value = this.goal.x;
    this.z.value = this.goal.z;
    this.distance.value = this.fit.distance * this.zoom;
    this.x.velocity = this.z.velocity = this.distance.velocity = 0;
  }

  /** this.view from where the camera sits round its aim now, so an orbit by hand is kept. */
  private readView(camera: THREE.Camera, c: Orbit): void {
    const dx = camera.position.x - c.target.x;
    const dy = camera.position.y - c.target.y;
    const dz = camera.position.z - c.target.z;
    this.view.azimuth = Math.atan2(dx, dz);
    this.view.elevation = Math.atan2(dy, Math.hypot(dx, dz));
  }
}
