import type { ColliderDesc } from '@dimforge/rapier3d-compat';
import { boxKindSize, type BoxKind } from '../boxKinds';
import type { HideSeekPhysics } from '../physics';
import { BOX_GROUPS } from './groups';
import type { Rapier } from './rapier';

/**
 * The collider of one box, centered on its body, which sits half the box
 * height above the floor. Crates are cuboids. A ramp is the convex hull of
 * its wedge, so a sight ray at any height hits exactly the drawn slope.
 *
 * Every box gets the same mass, centered on its footprint, with the
 * inertia of a cuboid of the same size. For a ramp that is a little off
 * from a solid wedge, whose mass sits toward the lip, but it means a ramp
 * is carried, pushed and turned just like a crate of its footprint, and
 * the body pose is always the center of the footprint.
 */
export function boxCollider(R: Rapier, p: HideSeekPhysics, kind: BoxKind): ColliderDesc {
  const s = boxKindSize(p, kind);
  const [hx, hy, hz] = [s.length / 2, s.height / 2, s.width / 2];
  const desc = kind === 'ramp' ? R.ColliderDesc.convexHull(wedgePoints(hx, hy, hz)) : R.ColliderDesc.cuboid(hx, hy, hz);
  if (!desc) throw new Error('Could not build the ramp collider.');
  const m = p.box.mass;
  const inertia = { x: (m * (s.height ** 2 + s.width ** 2)) / 12, y: (m * (s.length ** 2 + s.width ** 2)) / 12, z: (m * (s.length ** 2 + s.height ** 2)) / 12 };
  return desc
    .setMassProperties(m, { x: 0, y: 0, z: 0 }, inertia, { x: 0, y: 0, z: 0, w: 1 })
    .setFriction(p.box.friction)
    .setCollisionGroups(BOX_GROUPS);
}

/** The six corners of a wedge with half sizes (hx, hy, hz): low at local -x (the foot), full height at +x (the lip). */
function wedgePoints(hx: number, hy: number, hz: number): Float32Array {
  return Float32Array.from([-hx, -hy, -hz, -hx, -hy, hz, hx, -hy, -hz, hx, -hy, hz, hx, hy, -hz, hx, hy, hz]);
}
