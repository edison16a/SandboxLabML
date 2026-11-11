import type { Course } from '@/engine/navigation/course/build';

/**
 * Whether a crushed runner at (x, z) facing `yaw` was squeezed along its
 * own forward axis rather than across it, judged from the nearest mover
 * (`movers` holds each one's x, z this frame): the push runs from the
 * mover's middle to the runner. The pose flattens the runner along that
 * axis, so it reads as pressed against the wall and stays tall enough to
 * be seen over the mover.
 */
export function crushAlongForward(course: Course, movers: ArrayLike<number>, x: number, z: number, yaw: number): boolean {
  let best = Infinity;
  let px = 0;
  let pz = 0;
  for (let k = 0; k < course.movers.length; k++) {
    const m = course.movers[k];
    const dx = x - movers[k * 2];
    const dz = z - movers[k * 2 + 1];
    const gap = Math.hypot(Math.max(0, Math.abs(dx) - m.hx), Math.max(0, Math.abs(dz) - m.hz));
    if (gap < best) {
      best = gap;
      px = dx;
      pz = dz;
    }
  }
  const len = Math.hypot(px, pz);
  if (len < 1e-6) return false;
  return Math.abs((Math.cos(yaw) * px - Math.sin(yaw) * pz) / len) > Math.SQRT1_2;
}

/** The height of the mover nearest (x, z), m, or 1 when there is none: where a crush is marked so it shows over the crate. */
export function nearestMoverTop(course: Course, movers: ArrayLike<number>, x: number, z: number): number {
  let best = Infinity;
  let top = 1;
  for (let k = 0; k < course.movers.length; k++) {
    const d = Math.hypot(x - movers[k * 2], z - movers[k * 2 + 1]);
    if (d < best) {
      best = d;
      top = course.movers[k].height;
    }
  }
  return top;
}
