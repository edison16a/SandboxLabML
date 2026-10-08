/**
 * A mass on a spring with a damper: position and velocity. Unlike the
 * critically damped camera spring, these can be set to ring a little, the
 * way a car body settles after a bump: dip, rebound, settle.
 */
export interface Damped {
  x: number;
  v: number;
}

/** Longest integration step, s. Short enough to stay stable for a stiff spring at any frame rate. */
const MAX_STEP = 1 / 240;

/**
 * Advances a damped spring toward `target` by `dt` seconds. `freq` is the
 * natural frequency in Hz and `zeta` the damping ratio (1 settles with no
 * overshoot, lower rings). Integrated in fixed sub-steps with semi-implicit
 * Euler, so the motion looks the same at 30, 60 or 144 frames per second.
 * Returns the new position.
 */
export function stepDamped(s: Damped, target: number, freq: number, zeta: number, dt: number): number {
  const w = Math.PI * 2 * freq;
  const k = w * w;
  const c = 2 * zeta * w;
  let left = Math.min(dt, 0.25);
  while (left > 1e-6) {
    const h = Math.min(MAX_STEP, left);
    s.v += (k * (target - s.x) - c * s.v) * h;
    s.x += s.v * h;
    left -= h;
  }
  return s.x;
}

/** A fresh spring at rest. */
export function damped(x = 0): Damped {
  return { x, v: 0 };
}
