/**
 * The climbing rules of HideSeekPhysics: when an agent mounts a ramp, how
 * it moves on the slope, and how it jumps off the lip. They live in the
 * physics so they hash into the rules a brain was trained under. The ramp
 * itself is sized in HideSeekPhysics.box.ramp.
 */
export interface ClimbRules {
  /**
   * The mount zone at the foot of a ramp reaches this far out from the
   * foot, m. An agent walking into the slope comes to rest about 0.1 m
   * out, because its round bottom meets the thin end of the wedge.
   */
  footOut: number;
  /** ...and this far up the slope from the foot, m. */
  footIn: number;
  /** Smallest move output that mounts a ramp. */
  mountMove: number;
  /** Widest angle between the facing and the uphill direction that still mounts, rad. */
  mountAngle: number;
  /** Speed along the slope at full move output, as a share of agent maxSpeed. Backing down uses backwardShare of it. */
  speedShare: number;
  /** From this elevation an agent sees over boxes and is seen over them, m. */
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
}

/** The climbing rules every preset uses, each with the reason for its value. */
export const DEFAULT_CLIMB_RULES: ClimbRules = {
  // Room to mount from a short step back, and still less than an inner wall's thickness plus an agent's radius, so nobody mounts a ramp from the far side of a wall.
  footOut: 0.5,
  // Forgives an agent shoved a little onto the thin end, without letting it mount from the side further up.
  footIn: 0.3,
  // A brain idling near a ramp does not climb by accident; any deliberate drive forward does.
  mountMove: 0.2,
  // 45 degrees: a brain need not line up exactly, but brushing past the foot sideways does not mount.
  mountAngle: Math.PI / 4,
  // About 2 m/s, so the 2.4 m slope takes a little over a second: slower than the floor, quick enough that a vault pays in the seek phase.
  speedShare: 0.6,
  // The cube and plank height: eyes above it look over every crate. A ramp lip stands higher, so its top always sees over boxes.
  seeOverBoxes: 1,
  // Half a second is long enough to read as a jump on screen and short enough that a vault still pays.
  jumpSeconds: 0.5,
  // Clears an inner wall with an agent's width to spare, but a ramp has to stand close to a wall to vault it.
  jumpRange: 3,
  // A landing is at most 0.1 m further out than it needs to be, and planning a jump takes at most 30 checks.
  jumpStep: 0.1,
  // Enough that the arc reads as clearly over a wall top on screen.
  clearance: 0.3,
  // Landing and step off spots never touch anything, so the solver has no contact to resolve on that tick.
  landingGap: 0.02,
};
