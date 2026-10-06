import { hashObject } from '../core/hash';

/** Size of one box along its local x (length), local z (width) and y (height), m. */
export interface BoxSize {
  length: number;
  width: number;
  height: number;
}

/**
 * Every constant that shapes a Hide and Seek match. The whole object is
 * hashed onto stored genomes, so a brain trained under one set of rules
 * refuses to replay under another. Change a value here and it is a new game.
 */
export interface HideSeekPhysics {
  /** Seconds per tick. The simulation runs at a fixed 30 Hz. */
  dt: number;
  /** Match length, s. */
  matchSeconds: number;
  /** Share of the match spent in the prep phase, when seekers are frozen and blind. */
  prepShare: number;
  arena: {
    /** Inner side length of the square room, m. */
    size: number;
    wallHeight: number;
    outerWallThickness: number;
    innerWallThickness: number;
  };
  agent: {
    radius: number;
    height: number;
    mass: number;
    friction: number;
    /** Top forward speed, m/s. */
    maxSpeed: number;
    /** Top backward speed as a share of maxSpeed. */
    backwardShare: number;
    /** Turn rate at full turn output, rad/s. */
    turnRate: number;
  };
  box: {
    cube: BoxSize;
    plank: BoxSize;
    /**
     * A wedge: its top rises from 0 at the foot (local -x end) to `height`
     * at the lip (local +x end). The lip stands a little above a cube, so an
     * agent on it sees over every box, and the slope (about 27 degrees) is
     * long enough to take a second or so to climb.
     */
    ramp: BoxSize;
    mass: number;
    friction: number;
    /** Stands in for floor friction, since boxes slide on a plane with no floor contact. */
    linearDamping: number;
    angularDamping: number;
  };
  grab: {
    /** Max distance from the agent center to a box center, m. */
    range: number;
    /** Full width of the cone in front of the agent, rad. */
    cone: number;
    /** Share of the gap to the hold point closed each tick. */
    gain: number;
    maxSpeed: number;
    maxSpin: number;
    /** A held box this far from its hold point is dropped (it got stuck), m. */
    breakDistance: number;
  };
  lock: { range: number; cone: number };
  climb: {
    /**
     * The mount zone at the foot of a ramp reaches this far out from the
     * foot, m. An agent walking into the slope comes to rest about 0.1 m
     * out, because its round bottom meets the thin end of the wedge.
     */
    footOut: number;
    /** ...and this far up the slope from the foot, m. */
    footIn: number;
    /** Smallest move output that mounts a ramp, so a brain idling near one does not climb by accident. */
    mountMove: number;
    /** Widest angle between the facing and the uphill direction that still mounts, rad. */
    mountAngle: number;
    /** Speed along the slope at full move output, as a share of agent maxSpeed. Backing down uses backwardShare of it. */
    speedShare: number;
    /** From this elevation an agent sees over boxes and is seen over them, m: the cube and plank height. */
    seeOverBoxes: number;
    /** How long a jump off the lip lasts, s. Rounded to whole ticks. */
    jumpSeconds: number;
    /** Landing spots are tried every jumpStep m from just past the lip out to this distance, m. */
    jumpRange: number;
    jumpStep: number;
    /** The top of the jump arc clears the tallest thing it crosses by this much, m. */
    clearance: number;
    /** Air kept between a landing or step off spot and anything solid, m. */
    landingGap: number;
  };
  vision: {
    range: number;
    /** Full field of view, rad. */
    fov: number;
  };
  /**
   * Height of sensor rays and sight lines, m. Eyes at 1.2 m would look
   * straight over the 1 m boxes, so sight runs at half box height instead:
   * walls and boxes both block it, which is what makes building shelters
   * worth it. The shoulder sample points of the vision check sit here too.
   */
  rayHeight: number;
  spawn: {
    /** Random offset of each box from its layout spot, m, in x and z. */
    boxJitter: number;
    boxYawJitter: number;
  };
  solverIterations: number;
}

export const DEFAULT_HIDESEEK_PHYSICS: HideSeekPhysics = {
  dt: 1 / 30,
  matchSeconds: 30,
  prepShare: 0.3,
  arena: { size: 20, wallHeight: 2.5, outerWallThickness: 0.4, innerWallThickness: 0.2 },
  agent: { radius: 0.4, height: 1.6, mass: 60, friction: 0.2, maxSpeed: 3.5, backwardShare: 0.5, turnRate: 3 },
  box: {
    cube: { length: 1, width: 1, height: 1 },
    plank: { length: 2.4, width: 0.4, height: 1 },
    ramp: { length: 2.4, width: 1.2, height: 1.2 },
    mass: 30,
    friction: 0.8,
    linearDamping: 3,
    angularDamping: 4,
  },
  grab: { range: 1.6, cone: Math.PI / 2, gain: 0.8, maxSpeed: 8, maxSpin: 8, breakDistance: 1 },
  lock: { range: 1.6, cone: Math.PI / 2 },
  climb: {
    footOut: 0.6,
    footIn: 0.3,
    mountMove: 0.2,
    mountAngle: Math.PI / 4,
    speedShare: 0.6,
    seeOverBoxes: 1,
    // Half a second is long enough to read as a jump on screen and short enough that a vault still pays.
    jumpSeconds: 0.5,
    jumpRange: 3,
    jumpStep: 0.1,
    clearance: 0.3,
    landingGap: 0.02,
  },
  vision: { range: 14, fov: (135 * Math.PI) / 180 },
  rayHeight: 0.5,
  spawn: { boxJitter: 0.4, boxYawJitter: 0.3 },
  solverIterations: 4,
};

/** Overrides for `hideSeekPhysics`: any top-level value, or part of any group. */
export type HideSeekPhysicsOverrides = {
  [K in keyof HideSeekPhysics]?: HideSeekPhysics[K] extends object ? Partial<HideSeekPhysics[K]> : HideSeekPhysics[K];
};

/** Builds a physics config from partial overrides, merged one level deep. */
export function hideSeekPhysics(overrides: HideSeekPhysicsOverrides = {}): HideSeekPhysics {
  const d = DEFAULT_HIDESEEK_PHYSICS;
  return {
    ...d,
    ...overrides,
    arena: { ...d.arena, ...overrides.arena },
    agent: { ...d.agent, ...overrides.agent },
    box: { ...d.box, ...overrides.box },
    grab: { ...d.grab, ...overrides.grab },
    lock: { ...d.lock, ...overrides.lock },
    climb: { ...d.climb, ...overrides.climb },
    vision: { ...d.vision, ...overrides.vision },
    spawn: { ...d.spawn, ...overrides.spawn },
  };
}

/** Stable fingerprint of the rules. Stored genomes carry it so replays can refuse a mismatch. */
export function hideSeekPhysicsHash(p: HideSeekPhysics = DEFAULT_HIDESEEK_PHYSICS): string {
  return hashObject({ env: 'hideseek', ...p });
}

export function matchTicks(p: HideSeekPhysics): number {
  return Math.round(p.matchSeconds / p.dt);
}

/** Ticks 1 to prepTicks are the prep phase. Tick prepTicks + 1 is the first seek tick. */
export function prepTicks(p: HideSeekPhysics): number {
  return Math.round(matchTicks(p) * p.prepShare);
}

export * from './boxKinds';
