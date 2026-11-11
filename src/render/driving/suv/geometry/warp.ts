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
  // Corners pull back harder than the middle, so the nose and tail read round in plan.
  const a = Math.abs(z) / 0.85;
  const corner = 0.12 * a * a + 0.05 * a * a * a * a;
  let dx = 0;
  let dy = 0;
  if (x > 2.05) {
    dx -= smooth((x - 2.05) / 0.4) * (0.11 * clamp01((y - 0.6) / 0.44) ** 1.3 + corner + 0.03 * clamp01((0.45 - y) / 0.12));
    // The hood's front edge rolls down into the face instead of meeting it at a hard edge.
    dy -= smooth((x - 2.22) / 0.23) ** 2 * 0.022 * clamp01((y - 0.76) / 0.26);
  }
  if (x < -2.05) dx += smooth((-x - 2.05) / 0.4) * (0.035 * clamp01((y - 0.62) / 0.5) + corner * 0.6 + 0.05 * clamp01((0.52 - y) / 0.15));
  return [x + dx, y + dy, z];
}
