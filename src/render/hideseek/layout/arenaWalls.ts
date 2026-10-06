import { arenaWallRects } from '@/engine/hideseek/layouts/geometry';
import { getLayout, HIDESEEK_LAYOUT_IDS } from '@/engine/hideseek/layouts/presets';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';

const cache = new Map<number, Rect[]>();

/**
 * Every wall of a layout as floor rectangles, outer walls first, the same
 * list the engine builds its colliders and sensor rays from. Cached per
 * layout index since it never changes.
 */
export function wallsOfLayout(index: number): Rect[] {
  let rects = cache.get(index);
  if (!rects) {
    const id = HIDESEEK_LAYOUT_IDS[index] ?? HIDESEEK_LAYOUT_IDS[0];
    rects = arenaWallRects(getLayout(id), DEFAULT_HIDESEEK_PHYSICS);
    cache.set(index, rects);
  }
  return rects;
}

/** Most walls any built-in layout has, for sizing instance buffers. */
export const MAX_WALLS_PER_ARENA = Math.max(...HIDESEEK_LAYOUT_IDS.map((_, i) => wallsOfLayout(i).length));
