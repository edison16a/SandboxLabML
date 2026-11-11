import { smooth } from './curve';
import type { Vec3 } from './grid';

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

/**
 * A final bend applied to every point on the body. Sections are easiest
 * to draw upright and square, but a real nose rounds back toward the hood
 * and at its corners, and a real tail leans in toward the hatch. Running
 * the body, its caps and every lamp through the same bend keeps them
 * glued together.
 */
export function warp(p: Vec3): Vec3 {
  const [x, y, z] = p;
  let dx = 0;
  if (x > 2.05) dx -= smooth((x - 2.05) / 0.4) * (0.1 * clamp01((y - 0.72) / 0.24) + 0.11 * (z / 0.85) ** 2 + 0.03 * clamp01((0.45 - y) / 0.15));
  if (x < -2.05) dx += smooth((-x - 2.05) / 0.4) * (0.07 * clamp01((y - 0.62) / 0.45) + 0.1 * (z / 0.85) ** 2 + 0.05 * clamp01((0.5 - y) / 0.2));
  return [x + dx, y, z];
}
