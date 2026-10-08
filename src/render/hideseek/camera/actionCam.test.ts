import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { ARENA_SPAN } from '../layout/gridLattice';
import { actionBox, ACTION_BOX, type ActionPlayer } from './actionBox';
import { ActionCam, type ActionRoom } from './actionCam';
import { fitClearOf } from './fit';
import { Flight } from './flight';
import { closeShot } from './framing';

const FOV = 42;
/** A hider and an awake seeker at the given spots. */
const hider = (x: number, z: number): ActionPlayer => ({ x, z, elevation: 0, team: 0, frozen: false });
const seeker = (x: number, z: number): ActionPlayer => ({ x, z, elevation: 0, team: 1, frozen: false });
const ASPECT = 1.35;
const HALF = ARENA_SPAN / 2;

/** An action shot on a still camera, and a way to run it for some seconds of 60 Hz frames. */
function rig(agents: ActionPlayer[], cover = { w: 0, h: 0 }) {
  const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 1000);
  const orbit = { target: new THREE.Vector3(), update: () => {} };
  const cam = new ActionCam();
  const flight = new Flight();
  const room: ActionRoom = { agents, count: agents.length, walls: [], half: HALF, ox: 0, oz: 0 };
  const run = (seconds: number) => {
    for (let t = 0; t < seconds * 60; t++) {
      if (flight.t < 1) flight.step(camera, orbit, 1 / 60);
      cam.update(camera, orbit, flight, 7, room, cover, ASPECT, 1 / 60, 1);
    }
    camera.updateMatrixWorld();
  };
  return { camera, orbit, run };
}

/** Runs a fresh action shot for `seconds` and returns its camera and orbit point. */
function film(agents: ActionPlayer[], seconds: number) {
  const r = rig(agents);
  r.run(seconds);
  return r;
}

describe('the action box', () => {
  it('frames every player with a margin of floor', () => {
    const b = actionBox([hider(-2, 1), seeker(3, 2)], 2, HALF, { x: 0, z: 0, w: 0, d: 0 });
    expect(b.w).toBeCloseTo(5 + 2 * ACTION_BOX.margin);
    expect(b.x).toBeCloseTo(0.5);
    // Two players side by side still get the smallest span in depth.
    expect(b.d).toBeCloseTo(ACTION_BOX.minSpan);
  });

  it('keeps the hunting seeker in a capped box when the players are far apart', () => {
    const b = actionBox([hider(-9, -9), seeker(5, 5)], 2, HALF, { x: 0, z: 0, w: 0, d: 0 });
    expect(b.w).toBeCloseTo(ACTION_BOX.maxSpan);
    // The seeker stays a margin inside the box, which reaches toward the hider.
    expect(5).toBeLessThanOrEqual(b.x + b.w / 2 - ACTION_BOX.margin + 1e-9);
    expect(b.x).toBeLessThan(5);
    // In prep the seeker sleeps, so the box keeps the hider instead.
    const prep = actionBox([hider(-9, -9), { ...seeker(8, 8), frozen: true }], 2, HALF, { x: 0, z: 0, w: 0, d: 0 });
    expect(-9).toBeGreaterThanOrEqual(prep.x - prep.w / 2 - 1e-9);
  });

  it('stays inside the room, and is the whole room with nobody in it', () => {
    const b = actionBox([hider(9.5, -9.5)], 1, HALF, { x: 0, z: 0, w: 0, d: 0 });
    expect(b.x + b.w / 2).toBeLessThanOrEqual(HALF + 1e-9);
    expect(b.z - b.d / 2).toBeGreaterThanOrEqual(-HALF - 1e-9);
    const empty = actionBox([], 0, HALF, { x: 1, z: 1, w: 0, d: 0 });
    expect(empty).toEqual({ x: 0, z: 0, w: 2 * HALF, d: 2 * HALF });
  });
});

describe('the close action shot', () => {
  it('looks down at about 40 degrees and stands much nearer than the whole room shot', () => {
    const { camera, orbit } = film([hider(2, 3), seeker(4, 1)], 3);
    const d = camera.position.distanceTo(orbit.target);
    const flat = Math.hypot(camera.position.x - orbit.target.x, camera.position.z - orbit.target.z);
    expect((Math.atan2(camera.position.y - orbit.target.y, flat) * 180) / Math.PI).toBeCloseTo(40, 0);
    const room = closeShot(0, 0, ARENA_SPAN, FOV, ASPECT);
    expect(d).toBeLessThan(Math.hypot(room.px - room.tx, room.py - room.ty, room.pz - room.tz) * 0.7);
  });

  it('keeps both players on screen, above the picture in picture strip', () => {
    const agents = [hider(-5, 4), seeker(3, -2)];
    const { camera } = film(agents, 3);
    for (const a of agents) {
      for (const y of [0, 1.5]) {
        const p = new THREE.Vector3(a.x, y, a.z).project(camera);
        expect(Math.abs(p.x)).toBeLessThan(0.97);
        expect(p.y).toBeGreaterThan(-0.6);
        expect(p.y).toBeLessThan(0.86);
      }
    }
  });

  it('follows a runner on a spring instead of snapping', () => {
    const agents = [seeker(-6, 0)];
    const { orbit, run } = rig(agents);
    run(2);
    const start = orbit.target.x;
    agents[0].x = 6;
    run(0.1);
    const early = orbit.target.x;
    run(4);
    const settled = orbit.target.x;
    expect(early).toBeGreaterThan(start);
    // A tenth of a second in, it has gone less than a third of the way.
    expect(early - start).toBeLessThan((settled - start) / 3);
    expect(settled - start).toBeGreaterThan(4);
  });
});

describe('framing clear of a HUD card', () => {
  it('moves the room right of a tall card in the bottom left corner', () => {
    const cover = { w: 0.28, h: 0.5 };
    const fit = fitClearOf(20, 20, 2.5, FOV, ASPECT, (40 * Math.PI) / 180, 0, { h: 0.97, up: 0.92, down: 0.6 }, cover, { distance: 0, shift: 0, lateral: 0 });
    // The aim moves left, so the room sits right of the card.
    expect(fit.lateral).toBeLessThan(0);
    const camera = new THREE.PerspectiveCamera(FOV, ASPECT, 0.1, 1000);
    const aim = new THREE.Vector3(fit.lateral, 0, fit.shift);
    const e = (40 * Math.PI) / 180;
    camera.position.set(aim.x, Math.sin(e) * fit.distance, aim.z + Math.cos(e) * fit.distance);
    camera.lookAt(aim);
    camera.updateMatrixWorld();
    for (const [x, z] of [[-10, 10], [10, 10], [-10, -10], [10, -10]]) {
      const p = new THREE.Vector3(x, 0, z).project(camera);
      expect(p.x).toBeGreaterThan(-1 + 2 * cover.w);
      expect(p.x).toBeLessThan(1);
    }
  });
});
