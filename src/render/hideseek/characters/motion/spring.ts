/** One spring driven value: where it is and how fast it moves. */
export interface Spring {
  value: number;
  velocity: number;
}

export function spring(value = 0): Spring {
  return { value, velocity: 0 };
}

/** Longest single integration step, s. Stiff springs stay stable at any frame rate. */
const SUBSTEP = 1 / 240;

/**
 * Steps a damped spring toward `target` over `dt` seconds and returns its
 * new value. `omega` is the natural frequency (rad/s) and `zeta` the
 * damping ratio: 1 settles as fast as possible without overshoot, below 1
 * it overshoots and wobbles, which is what makes flesh and cloth read as
 * having weight. `force` is an extra acceleration, e.g. inertia pushing a
 * head back when the body accelerates. Integrated in small fixed substeps
 * (semi implicit Euler), so the motion is the same at 30 and 144 fps.
 * Allocates nothing.
 */
export function driveSpring(s: Spring, target: number, omega: number, zeta: number, dt: number, force = 0): number {
  let left = Math.min(dt, 0.1);
  const k = omega * omega;
  const c = 2 * zeta * omega;
  while (left > 1e-6) {
    const h = Math.min(SUBSTEP, left);
    s.velocity += (k * (target - s.value) - c * s.velocity + force) * h;
    s.value += s.velocity * h;
    left -= h;
  }
  return s.value;
}

/** Jumps a spring to rest at `value`, e.g. after a teleport. */
export function settleSpring(s: Spring, value: number): void {
  s.value = value;
  s.velocity = 0;
}

/** Moves `v` toward `target` at a rate that does not depend on frame rate: a first order lag. */
export function approach(v: number, target: number, rate: number, dt: number): number {
  return v + (target - v) * (1 - Math.exp(-rate * dt));
}
