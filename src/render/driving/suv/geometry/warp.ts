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
  if (x < -2.05) dx += smooth((-x - 2.05) / 0.4) * (0.035 * smooth((y - 0.62) / 0.5) + 0.05 * smooth((0.52 - y) / 0.15));
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
