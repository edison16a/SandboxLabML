import { hashObject } from '../core/hash';
import { DEFAULT_CLIMB_RULES, type ClimbRules } from './climbRules';

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
  /** When agents mount ramps, how they climb and how they jump off the lip (see climbRules.ts). */
  climb: ClimbRules;
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
  climb: DEFAULT_CLIMB_RULES,
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

/**
 * Rules read back from storage, made whole: physics saved before ramps has
 * no ramp size and no climb group, so those take the defaults. Complete
 * rules come back as the same object.
 */
export function normalizeHideSeekPhysics(p: HideSeekPhysics): HideSeekPhysics {
  return p.climb && p.box.ramp ? p : hideSeekPhysics(p);
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
export * from './climbRules';
