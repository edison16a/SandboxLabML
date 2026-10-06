import type { Vec2 } from './types';

/** Control points for a stadium oval: two straights joined by half circles. */
export function stadium(straight: number, radius: number, perArc = 6, perStraight = 3): Vec2[] {
  const pts: Vec2[] = [];
  const half = straight / 2;
  for (let k = 0; k < perStraight; k++) pts.push([-half + (straight * k) / perStraight, -radius]);
  for (let k = 0; k < perArc; k++) {
    const a = -Math.PI / 2 + (Math.PI * k) / perArc;
    pts.push([half + radius * Math.cos(a), radius * Math.sin(a)]);
  }
  for (let k = 0; k < perStraight; k++) pts.push([half - (straight * k) / perStraight, radius]);
  for (let k = 0; k < perArc; k++) {
    const a = Math.PI / 2 + (Math.PI * k) / perArc;
    pts.push([-half + radius * Math.cos(a), radius * Math.sin(a)]);
  }
  return pts;
}

/** Evenly spaced points on a circle, counterclockwise. */
export function circle(radius: number, count: number, cx = 0, cy = 0): Vec2[] {
  return Array.from({ length: count }, (_, k) => {
    const a = (2 * Math.PI * k) / count;
    return [cx + radius * Math.cos(a), cy + radius * Math.sin(a)] as Vec2;
  });
}
