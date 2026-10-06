import type { Pose } from '../frame';

export type HideSeekTeam = 'hider' | 'seeker';

/** Agent slots. Every per-agent array in the engine uses this order. */
export const HIDER = 0;
export const SEEKER = 1;
export const TEAMS: readonly HideSeekTeam[] = ['hider', 'seeker'];

/** `lastSeenAge` before an agent has ever seen its opponent, s. Large enough to compare against. */
export const NEVER_SEEN_AGE = 1e6;

/** What a sensor ray hit. Stored per ray in `rayHits`. */
export const HIT_NONE = 0;
export const HIT_WALL = 1;
export const HIT_BOX = 2;
export const HIT_AGENT = 3;
export const HIT_RAMP = 4;

/**
 * One agent as controllers and scripts see it. Scripts compile to direct
 * field reads on this object, so these names are part of the script API.
 * Positions are meters, angles radians, conventions as in frame.ts. Every
 * field describes the world right after the latest physics step.
 */
export interface HideSeekAgent extends Pose {
  readonly team: HideSeekTeam;
  /** 0 for the hider, 1 for the seeker. */
  readonly index: number;
  /** Forward speed, m/s, negative when backing up. */
  speed: number;
  /** Sideways speed, m/s, positive to the left. */
  sideSpeed: number;
  holding: boolean;
  /** Index of the held box, or -1. */
  heldBox: number;
  /** This agent has its opponent in sight. Seekers see nothing during prep. */
  seesOpponent: boolean;
  /** The hider is in the seeker's sight. Same value for both agents. */
  seen: boolean;
  /** Seek phase and the hider is out of sight. Same value for both agents. */
  hidden: boolean;
  /**
   * The seeker would see the hider if it turned to face it: the hider is
   * within vision range and nothing blocks the line between them. Unlike
   * `seen` it ignores which way the seeker faces, so it measures how well
   * the hider has taken cover however good or bad the seeker is. Updated
   * in prep too. Same value for both agents.
   */
  exposed: boolean;
  /** The step that just ran was part of the prep phase. */
  prep: boolean;
  /** Cannot act: a seeker during prep, or an agent its controller stopped. */
  frozen: boolean;
  /**
   * On a ramp slope. The engine moves it up and down the ramp with the move
   * output and nothing can push it; it cannot grab or lock until it is off.
   */
  climbing: boolean;
  /** In the air after running off a ramp lip. It cannot act until it lands. */
  airborne: boolean;
  /** Height of the agent's feet above the floor, m. 0 on the floor. */
  elevation: number;
  /** Index of the ramp it is climbing, or -1. Its own sight and sensor rays pass through that ramp. */
  climbRamp: number;
  /** Seconds elapsed in the match. */
  time: number;
  timeLeft: number;
  /** Seconds per tick, so controllers can turn per-second rewards into per-tick ones. */
  dt: number;
  opponentDistance: number;
  /** Seconds since this agent last saw its opponent, NEVER_SEEN_AGE if never. */
  lastSeenAge: number;
  /** Where the opponent was at the last sighting. Only meaningful once seen. */
  lastSeenX: number;
  lastSeenZ: number;
  /** Distance to the nearest cube or plank center, m. */
  nearestBoxDistance: number;
  /** Distance to the nearest ramp center, m. The room diagonal when there is none. */
  nearestRampDistance: number;
  /** Boxes of any kind locked by this agent's team, and by the other team. */
  boxesLockedByTeam: number;
  boxesLockedByOpponent: number;
  /** Events from the latest step. */
  justGrabbed: boolean;
  justReleased: boolean;
  justLocked: boolean;
  justUnlocked: boolean;
  /** Landed from a jump that crossed a wall. */
  justVaulted: boolean;
  /** Sum of rewards so far. */
  fitness: number;
  /** Why the controller stopped this agent, or null while it is playing. */
  stopReason: string | null;
  /** Sensor ray distances from the agent center, m, in input schema order. */
  rays: Float64Array;
  /** What each ray hit (HIT_NONE, HIT_WALL, HIT_BOX, HIT_AGENT or HIT_RAMP). */
  rayHits: Uint8Array;
  /** Totals for the match result. */
  grabs: number;
  locks: number;
  unlocks: number;
  /** Ramps mounted, and jumps that crossed a wall. */
  climbs: number;
  vaults: number;
}

export function createAgent(index: number, rayCount: number, dt: number): HideSeekAgent {
  return {
    team: TEAMS[index],
    index,
    x: 0,
    z: 0,
    yaw: 0,
    speed: 0,
    sideSpeed: 0,
    holding: false,
    heldBox: -1,
    seesOpponent: false,
    seen: false,
    hidden: false,
    exposed: false,
    prep: true,
    frozen: false,
    climbing: false,
    airborne: false,
    elevation: 0,
    climbRamp: -1,
    time: 0,
    timeLeft: 0,
    dt,
    opponentDistance: 0,
    lastSeenAge: NEVER_SEEN_AGE,
    lastSeenX: 0,
    lastSeenZ: 0,
    nearestBoxDistance: 0,
    nearestRampDistance: 0,
    boxesLockedByTeam: 0,
    boxesLockedByOpponent: 0,
    justGrabbed: false,
    justReleased: false,
    justLocked: false,
    justUnlocked: false,
    justVaulted: false,
    fitness: 0,
    stopReason: null,
    rays: new Float64Array(rayCount),
    rayHits: new Uint8Array(rayCount),
    grabs: 0,
    locks: 0,
    unlocks: 0,
    climbs: 0,
    vaults: 0,
  };
}

export function clearEvents(a: HideSeekAgent): void {
  a.justGrabbed = false;
  a.justReleased = false;
  a.justLocked = false;
  a.justUnlocked = false;
  a.justVaulted = false;
}
