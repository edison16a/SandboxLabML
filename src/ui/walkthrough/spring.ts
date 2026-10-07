/** Spring settings per unit of mass, the way most animation libraries name them. */
export interface SpringConfig {
  stiffness: number;
  damping: number;
}

/**
 * The spotlight's glide. The damping sits at the critical value for this
 * stiffness (2 times its square root), so the frame arrives quickly and
 * settles without bouncing past the target.
 */
export const GLIDE: SpringConfig = { stiffness: 190, damping: 27.6 };

/** A spring over several numbers at once, like the x, y, width and height of a box. */
export interface Spring {
  value: number[];
  velocity: number[];
}

export function createSpring(value: number[]): Spring {
  return { value: [...value], velocity: value.map(() => 0) };
}

/** Jumps straight to the target and stops, for reduced motion and the first frame. */
export function snapSpring(s: Spring, target: number[]): void {
  for (let i = 0; i < target.length; i++) {
    s.value[i] = target[i];
    s.velocity[i] = 0;
  }
}

const STEP = 1 / 240;
/**
 * The spring follows real time, so a busy page that draws few frames still
 * gets there on time. A tab that was hidden for a while moves it at most
 * this far, so it never jumps straight to the end.
 */
const MAX_DT = 1 / 4;

/**
 * Moves the spring `dt` seconds toward the target, in place. Small fixed
 * substeps keep it stable at any frame rate.
 */
export function stepSpring(s: Spring, target: number[], dt: number, cfg: SpringConfig = GLIDE): void {
  let left = Math.min(Math.max(dt, 0), MAX_DT);
  while (left > 1e-6) {
    const h = Math.min(STEP, left);
    for (let i = 0; i < target.length; i++) {
      const force = -cfg.stiffness * (s.value[i] - target[i]) - cfg.damping * s.velocity[i];
      s.velocity[i] += force * h;
      s.value[i] += s.velocity[i] * h;
    }
    left -= h;
  }
}

/** True once every number is within `eps` of the target and barely moving. */
export function isSettled(s: Spring, target: number[], eps = 0.05): boolean {
  return target.every((t, i) => Math.abs(s.value[i] - t) < eps && Math.abs(s.velocity[i]) < eps * 10);
}

/**
 * Steps the spring and lands it exactly on the target once it is close.
 * Without that last snap it would creep by fractions of a pixel for a long
 * time, keeping text blurry and the card never quite still.
 */
export function glide(s: Spring, target: number[], dt: number, eps = 0.3): void {
  stepSpring(s, target, dt);
  if (isSettled(s, target, eps)) snapSpring(s, target);
}
