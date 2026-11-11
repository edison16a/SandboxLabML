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
  if (x > 2.05) dx -= smooth((x - 2.05) / 0.4) * (0.11 * smooth((y - 0.6) / 0.44) ** 1.3 + 0.03 * smooth((0.45 - y) / 0.12));
  if (x < -2.05) dx += smooth((-x - 2.05) / 0.4) * (0.035 * smooth((y - 0.62) / 0.5) + 0.05 * smooth((0.52 - y) / 0.15));
  return [x + dx, y, z];
}
