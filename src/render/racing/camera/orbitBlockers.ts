import type * as THREE from 'three';
import { padOf, type Pad } from '../stadium/layout';
import { PIT_CANOPY, PIT_TOP, roofFront } from '../stadium/dimensions';
import { barrierOffset } from '../TrackMesh';
import type { WorldData } from '../world/worldData';
import { hitSpan, type Span } from './sightLines';

/** Something solid between heights `bottom` and `top`, m, over a pad. */
interface Blocker {
  pad: Pad;
  bottom: number;
  top: number;
}

/** Height of the catch fence's top rail and of a stand's roof, m. */
const FENCE_TOP = 4.8;
const STAND_TOP = 15.5;

const cache = new WeakMap<WorldData, Blocker[]>();

/**
 * What a free camera should not look through: the catch fence along the
 * stands, the stands with their roofs, the pit building and its canopy
 * (a slab high over the lane, which a low camera looks under).
 */
function blockersOf(world: WorldData): Blocker[] {
  let list = cache.get(world);
  if (list) return list;
  const l = world.layout;
  list = [];
  if (l.stands.length) {
    const lo = Math.min(...l.stands.map((s) => s.along - s.length / 2)) - 4;
    const hi = Math.max(...l.stands.map((s) => s.along + s.length / 2)) + 4;
    const fence = { along: (lo + hi) / 2, length: hi - lo, offset: barrierOffset(world.track) - 0.3, depth: 0.6 };
    list.push({ pad: padOf(l, l.side, fence), bottom: 0, top: FENCE_TOP });
  }
  const roof = roofFront().z;
  for (const s of l.stands) list.push({ pad: padOf(l, l.side, { ...s, offset: s.offset + roof, depth: s.depth - roof }), bottom: 0, top: STAND_TOP });
  const pit = l.pit;
  if (pit) {
    // The roof's plant units stand about a meter and a half over the deck.
    list.push({ pad: padOf(l, -l.side, pit), bottom: 0, top: PIT_TOP + 1.6 });
    list.push({ pad: padOf(l, -l.side, { ...pit, offset: pit.offset - PIT_CANOPY, depth: PIT_CANOPY }), bottom: PIT_TOP - 0.3, top: PIT_TOP + 1 });
  }
  cache.set(world, list);
  return list;
}

const span: Span = { lo: 0, hi: 1 };

/**
 * How far along the line from `from` to `to` a camera can go before a
 * building or the fence gets in the way, as a fraction of the line: 1 when
 * nothing does. A line passing over or under a blocker does not count.
 */
export function clearFraction(world: WorldData, from: THREE.Vector3, to: THREE.Vector3): number {
  let t = 1;
  const list = blockersOf(world);
  for (let k = 0; k < list.length; k++) {
    const b = list[k];
    if (!hitSpan(b.pad, from.x, from.z, to.x, to.z, span) || span.lo >= t) continue;
    // The line's height is linear, so its range over the span is set by the two ends.
    const y0 = from.y + (to.y - from.y) * span.lo;
    const y1 = from.y + (to.y - from.y) * span.hi;
    if (Math.max(y0, y1) < b.bottom || Math.min(y0, y1) > b.top) continue;
    t = span.lo;
  }
  return t;
}
