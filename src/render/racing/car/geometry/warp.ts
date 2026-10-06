import { smooth } from './curve';
import type { Vec3 } from './grid';

/**
 * A final bend applied to every point that sits on the body. The sections
 * are easiest to draw upright and square, but a real nose leans back below
 * the hood line and rounds off at the corners, and the tail does the same.
 * Running the body, its caps and every decal through the same bend keeps
 * them glued together.
 */
export function warp(p: Vec3): Vec3 {
  const [x, y, z] = p;
  let dx = 0;
  if (x > 1.9) dx -= smooth((x - 1.9) / 0.34) * (0.2 * clamp01((0.52 - y) / 0.4) + 0.1 * (z / 0.75) ** 2);
  if (x < -1.9) dx += smooth((-x - 1.9) / 0.34) * (0.06 * clamp01((0.8 - y) / 0.68) + 0.07 * (z / 0.8) ** 2);
  return [x + dx, y, z];
}

const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
