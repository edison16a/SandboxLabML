import type { WorldState } from '@/engine/driving/world/state';
import { BODY } from '../suv/dimensions';

/** Half the followed SUV's footprint, padded a little so a car about to touch it already starts to fade, m. */
const FOCUS_HALF = { l: BODY.length / 2 + 0.3, w: BODY.width / 2 + 0.2 };

/** Whether traffic car i's footprint overlaps the followed SUV's (separating axes on both boxes). */
export function overlapsFocus(world: WorldState, i: number, x: number, y: number, heading: number): boolean {
  const dx = world.carX[i] - x;
  const dy = world.carY[i] - y;
  if (dx * dx + dy * dy > 49) return false;
  const ca = Math.cos(heading);
  const sa = Math.sin(heading);
  const cb = Math.cos(world.carHeading[i]);
  const sb = Math.sin(world.carHeading[i]);
  const bl = world.carLength[i] / 2;
  const bw = world.carWidth[i] / 2;
  for (let k = 0; k < 4; k++) {
    const ux = k === 0 ? ca : k === 1 ? -sa : k === 2 ? cb : -sb;
    const uy = k === 0 ? sa : k === 1 ? ca : k === 2 ? sb : cb;
    const ra = FOCUS_HALF.l * Math.abs(ca * ux + sa * uy) + FOCUS_HALF.w * Math.abs(-sa * ux + ca * uy);
    const rb = bl * Math.abs(cb * ux + sb * uy) + bw * Math.abs(-sb * ux + cb * uy);
    if (Math.abs(dx * ux + dy * uy) > ra + rb) return false;
  }
  return true;
}
