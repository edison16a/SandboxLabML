import type { HideSeekPhysics } from '../physics';
import type { ArenaLayout, Rect, WallSegment } from './types';

/**
 * Outer walls sit just outside the room, so the inside is exactly
 * size x size and centered on the origin. Order: far (-z), near (+z),
 * left (-x), right (+x).
 */
export function outerWallRects(p: HideSeekPhysics): Rect[] {
  const h = p.arena.size / 2;
  const t = p.arena.outerWallThickness / 2;
  const long = h + 2 * t;
  return [
    { x: 0, z: -h - t, hx: long, hz: t },
    { x: 0, z: h + t, hx: long, hz: t },
    { x: -h - t, z: 0, hx: t, hz: long },
    { x: h + t, z: 0, hx: t, hz: long },
  ];
}

/** Interior walls grow by half their thickness at each end so corners close without gaps. */
export function segmentRect(seg: WallSegment, thickness: number): Rect {
  const [x0, z0] = seg.from;
  const [x1, z1] = seg.to;
  const t = thickness / 2;
  if (z0 === z1) return { x: (x0 + x1) / 2, z: z0, hx: Math.abs(x1 - x0) / 2 + t, hz: t };
  if (x0 === x1) return { x: x0, z: (z0 + z1) / 2, hx: t, hz: Math.abs(z1 - z0) / 2 + t };
  throw new Error('Interior walls must run along x or along z.');
}

/** Every wall of an arena, outer first, as rectangles. The world builder and the ray caster both use this list. */
export function arenaWallRects(layout: ArenaLayout, p: HideSeekPhysics): Rect[] {
  return [...outerWallRects(p), ...layout.walls.map((w) => segmentRect(w, p.arena.innerWallThickness))];
}

/** Distance from a point to an axis-aligned rectangle, 0 when inside. */
export function distanceToRect(px: number, pz: number, r: Rect): number {
  const dx = Math.max(Math.abs(px - r.x) - r.hx, 0);
  const dz = Math.max(Math.abs(pz - r.z) - r.hz, 0);
  return Math.hypot(dx, dz);
}

/**
 * Distance from a point to a box rotated by `yaw` (see frame.ts), 0 when
 * inside. The box's local x runs along its length.
 */
export function distanceToBox(px: number, pz: number, cx: number, cz: number, hx: number, hz: number, yaw: number): number {
  const dx = px - cx;
  const dz = pz - cz;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.hypot(Math.max(Math.abs(lx) - hx, 0), Math.max(Math.abs(lz) - hz, 0));
}
