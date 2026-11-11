import { describe, expect, it } from 'vitest';
import type { AgentController } from '../../env/types';
import { FLAG_CRUSHED, FLAG_PUSHED, FLAG_SPIKED, NAV_DIED, NAV_FINISHED, NAV_RUNNING, NAV_STOPPED, type NavAgent } from '../agent';
import { builtinNavigationController } from '../builtinReward';
import type { Course } from '../course/build';
import type { MoverSpec } from '../course/types';
import { NavigationEnv, type NavBrain } from '../env';
import { deepestOverlap } from '../kinematics/collide';
import { STANDARD_NAVIGATION_INPUTS } from '../sensors/inputConfig';
import { params, R, room } from './helpers';

/** Holds the given move and turn every tick. */
function hold(move: number, turn = 0): AgentController<NavAgent> {
  return {
    customSensorCount: 0,
    sensors() {},
    tick(_a, io) {
      io.action[0] = move;
      io.action[1] = turn;
    },
  };
}

const idle: NavBrain = { activate() {} };

/** One agent on the course, placed at (x, z) facing +x, run until it stops or `ticks` pass. */
function runOne(course: Course, x: number, z: number, controller: AgentController<NavAgent>, ticks = 600): { env: NavigationEnv; a: NavAgent } {
  const env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller });
  env.reset([idle], [1]);
  const a = env.agents[0];
  a.x = x;
  a.z = z;
  a.yaw = 0;
  for (let t = 0; t < ticks && !env.done; t++) env.step();
  return { env, a };
}

describe('spikes', () => {
  it('end the run as a death when walked onto', () => {
    const course = room([{ kind: 'spikes', x: 0, z: 0, hx: 0.6, hz: 2 }]);
    const { a } = runOne(course, -6, 0, hold(1));
    expect(a.status).toBe(NAV_DIED);
    expect(a.stopReason).toBe('spikes');
    expect(a.flags & FLAG_SPIKED).toBeTruthy();
    // It died right at the pad's edge, not past it.
    expect(a.x).toBeLessThan(-0.6 + R);
    expect(a.x).toBeGreaterThan(-0.6 - R);
  });

  it('forgive a graze along their trim', () => {
    const course = room([{ kind: 'spikes', x: 0, z: 1, hx: 3, hz: 0.5 }]);
    // Walking past with its side 5 cm over the pad's edge.
    const { a } = runOne(course, -6, 1 - 0.5 - R + 0.05, hold(1), 120);
    expect(a.status).toBe(NAV_RUNNING);
  });
});

describe('hazard distances', () => {
  it('read how close the agent is to spikes and movers', () => {
    const course = room([
      { kind: 'spikes', x: 3, z: 0, hx: 0.5, hz: 0.5 },
      { kind: 'mover', hx: 0.5, hz: 0.5, height: 1, ax: -3, az: 0, bx: -3, bz: 0.001, period: 10, phase: 0 },
    ]);
    const { a } = runOne(course, 0, 0, hold(0), 1);
    expect(a.spikeDistance).toBeCloseTo(3 - 0.5 - R, 2);
    expect(a.moverDistance).toBeCloseTo(3 - 0.5 - R, 2);
  });
});

describe('movers', () => {
  const mover = (z0: number, z1: number, period = 3, phase = 0): MoverSpec => ({ kind: 'mover', hx: 0.6, hz: 0.8, height: 1, ax: 0, az: z0, bx: 0, bz: z1, period, phase });

  it('push an agent standing in their way without hurting it', () => {
    // Sweeps z from -4 to 2; the agent waits at z 0 in the open, so it is shoved toward +z.
    const course = room([mover(-4, 2)]);
    const env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: hold(0), maxTime: 1e9 });
    env.reset([idle], [1]);
    const a = env.agents[0];
    Object.assign(a, { x: 0, z: 0.4, yaw: 0 });
    let pushed = false;
    for (let t = 0; t < 90; t++) {
      env.step();
      pushed ||= (a.flags & FLAG_PUSHED) !== 0;
      expect(deepestOverlap(a.x, a.z, R, course.solidData, course.solids.length)).toBeLessThanOrEqual(1e-6);
    }
    expect(pushed).toBe(true);
    expect(a.status).toBe(NAV_RUNNING);
    expect(a.z).toBeGreaterThan(2.8 - 0.05);
  });

  it('crush an agent caught against a wall', () => {
    // The mover stops 10 cm short of a wall; an agent standing in that slot is squeezed.
    const course = room([{ kind: 'wall', x: 0, z: 4.15, hx: 1.5, hz: 0.15 }, mover(-2, 4 - 0.8 - 0.1, 3, 0)]);
    const { a } = runOne(course, 0, 3.4, hold(0), 200);
    expect(a.status).toBe(NAV_DIED);
    expect(a.stopReason).toBe('crushed');
    expect(a.flags & FLAG_CRUSHED).toBeTruthy();
  });

  it('stop agents that walk into them like a wall', () => {
    const course = room([mover(-0.5, 0.5, 6, 0)]);
    const env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: hold(1), maxTime: 1e9 });
    env.reset([idle], [1]);
    const a = env.agents[0];
    Object.assign(a, { x: -5, z: 0, yaw: 0 });
    for (let t = 0; t < 120; t++) env.step();
    expect(a.x).toBeLessThan(-0.6 - R + 0.1);
  });
});

describe('the start pad', () => {
  it('never traps an agent that starts inside a crate', () => {
    const course = room([{ kind: 'block', x: -12.4, z: 0, hx: 0.6, hz: 1.6, height: 1 }]);
    const env = new NavigationEnv({ course, params, inputs: STANDARD_NAVIGATION_INPUTS, controller: hold(1) });
    env.reset([idle, idle, idle], [1, 2, 3]);
    for (const a of env.agents) expect(deepestOverlap(a.x, a.z, R, course.solidData, course.solids.length)).toBeLessThanOrEqual(1e-6);
    const start = env.agents.map((a) => [a.x, a.z]);
    for (let t = 0; t < 30; t++) {
      env.step();
      for (const a of env.agents) expect(deepestOverlap(a.x, a.z, R, course.solidData, course.solids.length)).toBeLessThanOrEqual(1e-6);
    }
    const moved = env.agents.reduce((sum, a, i) => sum + Math.hypot(a.x - start[i][0], a.z - start[i][1]), 0);
    expect(moved).toBeGreaterThan(0.5);
  });
});

describe('ends of a run', () => {
  it('finishes once the line is crossed', () => {
    const course = room([]);
    const { a, env } = runOne(course, course.finishX - 2, 0, hold(1));
    expect(a.status).toBe(NAV_FINISHED);
    expect(a.finishTime).toBeGreaterThan(0.4);
    expect(a.progress).toBe(1);
    expect(env.done).toBe(true);
  });

  it('times out, and stops a run that makes no progress', () => {
    const course = room([]);
    const env = new NavigationEnv({ course, params: { ...params, stuckSeconds: Infinity }, inputs: STANDARD_NAVIGATION_INPUTS, controller: hold(0.05) });
    env.reset([idle], [1]);
    while (!env.done) env.step();
    expect(env.agents[0].stopReason).toBe('time');
    // Its own limit: the course's, plus the walk from its spot behind the start line.
    expect(env.agents[0].timeLimit).toBeGreaterThan(course.timeLimit);
    expect(env.agents[0].time).toBeCloseTo(env.agents[0].timeLimit, 1);
    const stuck = runOne(course, 0, 0, builtinNavigationController, 2000);
    expect(stuck.a.status).toBe(NAV_STOPPED);
    expect(stuck.a.stopReason).toBe('stuck');
    expect(stuck.a.time).toBeCloseTo(4, 0);
  });
});
