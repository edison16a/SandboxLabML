import { Rng } from '../core/rng';
import type { Course } from './course/build';
import { sampleDistance } from './course/fieldSample';
import { formationSpot, seedSlot } from './course/formation';
import { pushOut } from './kinematics/collide';
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

/** The farthest the hazard distances read, m: anything further is simply far. */
export const NEAR_CAP = 20;

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
  /** Per agent seed (from run seed, generation and genome). Noise, script rand() and the small offset off its start spot derive from it, so a replay alone matches. */
  seed: number;
  /** Its spot on the start grid (see formation.ts). */
  slot: number;
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
  /** Walking distance from its own start spot to the finish, m. */
  startDistance: number;
  /** Share of its own walk covered now, and at its best, 0 to 1. Rewards pay on it, so a spot at the back of the grid costs nothing. */
  progress: number;
  bestProgress: number;
  /** Share of the course's walk covered, measured from the start line and the same for everyone: how the view and the leader compare agents. 0 behind the line. */
  courseProgress: number;
  /** How much bestProgress grew in the latest tick. The built in reward pays for it. */
  progressGain: number;
  /** Walking distance left to the finish, m. */
  distanceLeft: number;
  time: number;
  /** Its time limit, s: the run ends as "time" once time reaches it. The episode length, plus the time to walk the extra way from a spot further back at half speed. */
  timeLimit: number;
  /** Seconds since bestProgress last grew. */
  noProgress: number;
  /** Distance from the agent's edge to the nearest spike pad and to the nearest mover, m, capped at NEAR_CAP. Scripts can shape rewards on them. */
  spikeDistance: number;
  moverDistance: number;
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
 * Where an agent starts: on its spot of the start grid (its slot, or one
 * from its seed when it has none), stood a few cm off it and turned a
 * little by its own seed, so the grid looks like a crowd lining up.
 */
export function startSpot(course: Course, params: NavigationParams, seed: number, slot: number, out: { x: number; z: number; yaw: number }): void {
  formationSpot(course.formation, slot, out);
  const rng = new Rng(seed ^ 0x5eed);
  const s = params.start;
  out.x += rng.range(-s.jitter, s.jitter);
  out.z += rng.range(-s.jitter, s.jitter);
  out.yaw = rng.range(-s.jitterYaw, s.jitterYaw);
}

const pose = { x: 0, z: 0, yaw: 0 };

/**
 * A fresh agent on its start spot, freed from any solid a course put on
 * the grid. `timeLimit` is the episode length; an agent further back than
 * the start line gets the time to walk the difference at half speed.
 */
export function createNavAgent(index: number, course: Course, params: NavigationParams, rayCount: number, seed = index, timeLimit = course.timeLimit, slot?: number): NavAgent {
  const spot = slot ?? seedSlot(seed, course.formation);
  startSpot(course, params, seed, spot, pose);
  pushOut(pose, params.agent.radius, course.solidData, course.solids.length, 8);
  const d = sampleDistance(course.field, pose.x, pose.z);
  const startDistance = Number.isFinite(d) ? Math.max(d, 1) : course.spec.length * 2;
  const behind = Number.isFinite(course.startDistance) ? Math.max(0, startDistance - course.startDistance) : 0;
  return {
    index,
    seed,
    slot: spot,
    x: pose.x,
    z: pose.z,
    yaw: pose.yaw,
    speed: 0,
    vx: 0,
    vz: 0,
    turn: 0,
    startDistance,
    progress: 0,
    bestProgress: 0,
    courseProgress: 0,
    progressGain: 0,
    distanceLeft: startDistance,
    time: 0,
    timeLimit: timeLimit + behind / (params.agent.maxSpeed * 0.5),
    noProgress: 0,
    spikeDistance: NEAR_CAP,
    moverDistance: NEAR_CAP,
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
