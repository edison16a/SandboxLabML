import { Rng } from '../core/rng';
import type { Course } from './course/build';
import type { NavigationParams } from './params';

/** Where an agent's run stands. The snapshot carries it as a float. */
export const NAV_RUNNING = 0;
export const NAV_FINISHED = 1;
export const NAV_DIED = 2;
/** Out of time, stuck, or stopped by a script. */
export const NAV_STOPPED = 3;

/** Snapshot flag bits: what happened to an agent, for the renderer and scripts. */
export const FLAG_TOUCHING = 1;
export const FLAG_PUSHED = 2;
export const FLAG_SPIKED = 4;
export const FLAG_CRUSHED = 8;
export const FLAG_TIMEOUT = 16;
export const FLAG_STUCK = 32;

/** What a ray hit, as stored per ray. */
export const RAY_NONE = 0;
export const RAY_SOLID = 1;
export const RAY_SPIKES = 2;
export const RAY_MOVER = 3;

/**
 * One agent in an episode: its body, its progress and everything scripts
 * can read. Scripts compile to direct field reads on this object, which
 * keeps them fast, so the names here are the script API's names.
 */
export interface NavAgent {
  index: number;
  /** Per agent seed (from run seed, generation and genome). Start spot, noise and script rand() derive from it, so a replay alone matches. */
  seed: number;
  x: number;
  z: number;
  /** Heading, rad: 0 faces +x (toward the finish), positive turns toward -z. */
  yaw: number;
  /** Forward speed the agent is driving at, m/s, negative when backing up. */
  speed: number;
  /** Real velocity after sliding and pushes, m/s. */
  vx: number;
  vz: number;
  /** Turn rate this tick, rad/s. */
  turn: number;
  /** Share of the start's walking distance covered now, and at its best, 0 to 1. */
  progress: number;
  bestProgress: number;
  /** How much bestProgress grew in the latest tick. The built in reward pays for it. */
  progressGain: number;
  /** Walking distance left to the finish, m. */
  distanceLeft: number;
  time: number;
  /** Episode length, s: the run ends as "time" once time reaches it. */
  timeLimit: number;
  /** Seconds since bestProgress last grew. */
  noProgress: number;
  /** Events of the latest tick. */
  touching: boolean;
  pushed: boolean;
  finishedNow: boolean;
  diedNow: boolean;
  /** Ray distances, m, and what each hit (RAY_*). */
  rays: Float64Array;
  rayHits: Uint8Array;
  status: number;
  stopReason: string | null;
  flags: number;
  fitness: number;
  /** When it finished, s, or 0. */
  finishTime: number;
  /** When its run ended for any reason, s, or 0 while running. The renderer times death and finish moments from it. */
  stopTime: number;
}

/**
 * Where an agent starts: near the pad center, offset and turned a little
 * by its own seed. Brains so meet slightly different starts every episode
 * and learn to navigate rather than replay one path, and the crowd spreads
 * over the pad instead of standing in one spot.
 */
export function startPose(course: Course, params: NavigationParams, seed: number, out: { x: number; z: number; yaw: number }): void {
  const rng = new Rng(seed ^ 0x5eed);
  const s = params.start;
  out.x = course.startX + rng.range(-s.jitterX, s.jitterX);
  out.z = course.startZ + rng.range(-s.jitterZ, s.jitterZ);
  out.yaw = rng.range(-s.jitterYaw, s.jitterYaw);
}

const pose = { x: 0, z: 0, yaw: 0 };

export function createNavAgent(index: number, course: Course, params: NavigationParams, rayCount: number, seed = index, timeLimit = course.timeLimit): NavAgent {
  startPose(course, params, seed, pose);
  return {
    index,
    seed,
    x: pose.x,
    z: pose.z,
    yaw: pose.yaw,
    speed: 0,
    vx: 0,
    vz: 0,
    turn: 0,
    progress: 0,
    bestProgress: 0,
    progressGain: 0,
    distanceLeft: course.startDistance,
    time: 0,
    timeLimit,
    noProgress: 0,
    touching: false,
    pushed: false,
    finishedNow: false,
    diedNow: false,
    rays: new Float64Array(rayCount),
    rayHits: new Uint8Array(rayCount),
    status: NAV_RUNNING,
    stopReason: null,
    flags: 0,
    fitness: 0,
    finishTime: 0,
    stopTime: 0,
  };
}

/** Ends an agent's run. `reason` names why: "finished", "spikes", "crushed", "time", "stuck" or a script's own word. */
export function stopAgent(a: NavAgent, reason: string): void {
  if (a.status !== NAV_RUNNING) return;
  a.stopReason = reason;
  a.stopTime = a.time;
  a.speed = 0;
  a.vx = 0;
  a.vz = 0;
  a.turn = 0;
  if (reason === 'finished') {
    a.status = NAV_FINISHED;
    a.finishTime = a.time;
  } else if (reason === 'spikes' || reason === 'crushed') {
    a.status = NAV_DIED;
    a.flags |= reason === 'spikes' ? FLAG_SPIKED : FLAG_CRUSHED;
  } else {
    a.status = NAV_STOPPED;
    if (reason === 'time') a.flags |= FLAG_TIMEOUT;
    if (reason === 'stuck') a.flags |= FLAG_STUCK;
  }
}
