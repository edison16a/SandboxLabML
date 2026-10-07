import type { Vec3 } from './vec';

/**
 * Two bone inverse kinematics, the way a leg or an arm bends: from `root`
 * (hip or shoulder) with bones `a` and `b` long, reach for `target`,
 * bending the middle joint (knee or elbow) toward the direction `pole`.
 * A target out of reach is pulled in along the same line, so the limb
 * straightens and points at it, which is what lifts a foot off the floor
 * when the body rises faster than the leg can follow. Writes the middle
 * joint into `mid` and the reached end into `end`. Allocates nothing.
 */
export function solveTwoBone(root: Vec3, target: Vec3, a: number, b: number, pole: Vec3, mid: Vec3, end: Vec3): void {
  let dx = target.x - root.x;
  let dy = target.y - root.y;
  let dz = target.z - root.z;
  const d = Math.hypot(dx, dy, dz);
  if (d < 1e-6) {
    dx = 0;
    dy = -1;
    dz = 0;
  } else {
    dx /= d;
    dy /= d;
    dz /= d;
  }
  const reach = Math.min(Math.max(d, Math.abs(a - b) + 1e-4), (a + b) * 0.9995);
  end.x = root.x + dx * reach;
  end.y = root.y + dy * reach;
  end.z = root.z + dz * reach;
  // Law of cosines: how far along the line the middle joint sits, and how far off it.
  const along = (a * a - b * b + reach * reach) / (2 * reach);
  const off = Math.sqrt(Math.max(0, a * a - along * along));
  // The bend direction: the pole with its component along the limb removed.
  const k = pole.x * dx + pole.y * dy + pole.z * dz;
  let px = pole.x - dx * k;
  let py = pole.y - dy * k;
  let pz = pole.z - dz * k;
  const pl = Math.hypot(px, py, pz);
  if (pl < 1e-6) {
    // The pole lies along the limb: bend toward any direction square to it.
    px = -dy;
    py = dx;
    pz = 0;
  }
  const pn = Math.max(1e-6, Math.hypot(px, py, pz));
  mid.x = root.x + dx * along + (px / pn) * off;
  mid.y = root.y + dy * along + (py / pn) * off;
  mid.z = root.z + dz * along + (pz / pn) * off;
}
