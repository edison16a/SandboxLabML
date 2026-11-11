import { BODY } from '../dimensions';
import { smooth } from './curve';
import type { Vec3 } from './grid';

/**
 * A final bend applied to every point on the body. Sections are easiest
 * to draw upright, but a real nose rakes back toward the hood and a real
 * tail leans in toward the hatch. The corners themselves are rounded in
 * the sections (see endRound). Running
 * the body, its caps and every lamp through the same bend keeps them
 * glued together. Every ramp eases in and out, so the bend never puts a
 * slope break (and a line of light) into the paint.
 */
export function warp(p: Vec3): Vec3 {
  const [x, y, z] = p;
  let dx = 0;
  if (x > RAKE.from) dx -= smooth((x - RAKE.from) / (BODY.nose - RAKE.from)) * (rake(y) + 0.035 * smooth((0.46 - y) / 0.13));
  if (x < -2.05) dx += smooth((-x - 2.05) / 0.4) * (0.035 * smooth((y - 0.62) / 0.5) + fold(y) + 0.045 * smooth((0.55 - y) / 0.2));
  return [x + dx, y, z];
}

/** The nose rake: the face leans back `lean` m by the height `top`, starting upright at `base`. Eased in from `from` along the car. */
const RAKE = { from: 1.85, base: 0.48, top: 0.98, lean: 0.22 };

/**
 * How far the nose leans back at height y. It grows with the square of the
 * height, so the face is upright at the bumper and leans more and more
 * toward the hood, a convex curve with no flat spot or kink. Above the top
 * it carries on at the same slope.
 */
function rake(y: number): number {
  const t = (y - RAKE.base) / (RAKE.top - RAKE.base);
  if (t <= 0) return 0;
  return RAKE.lean * (t <= 1 ? t * t : 2 * t - 1);
}

/**
 * The tail's shoulder fold: the side's shoulder carried round the tail as
 * a soft horizontal crease. Above `at` the face leans in toward the hatch
 * at `slope`; the lean switches on over `onset` m, which draws the crease,
 * and off again `off` m higher, so the deck and the cabin are not bent.
 */
export const FOLD = { at: 1.045, onset: 0.018, slope: 0.32, off: 0.17 };

/** The fold's lean, integrated once from its slope in 1 mm steps. */
const FOLD_LEAN = (() => {
  const out = [0];
  for (let i = 1; i <= 260; i++) {
    const d = (i - 0.5) / 1000;
    out.push(out[i - 1] + (FOLD.slope * smooth(d / FOLD.onset) * smooth((FOLD.off - d) / 0.05)) / 1000);
  }
  return out;
})();

function fold(y: number): number {
  const d = (y - FOLD.at) * 1000;
  if (d <= 0) return 0;
  if (d >= FOLD_LEAN.length - 1) return FOLD_LEAN[FOLD_LEAN.length - 1];
  const i = Math.floor(d);
  return FOLD_LEAN[i] + (FOLD_LEAN[i + 1] - FOLD_LEAN[i]) * (d - i);
}
