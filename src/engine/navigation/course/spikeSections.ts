import { snap, type CourseDraft } from './draft';
import { MIN_GAP, TRIES } from './sections';
import type { Rect } from './types';

/**
 * One spike pad across the middle of the room at about x, with a wide
 * lane round each side of it: the gentlest spikes, met first on the
 * Spikes level, where the way round is plain and only a careless line is
 * punished.
 */
export function spikeIsland(d: CourseDraft, x: number): void {
  const half = d.width / 2;
  for (let t = 0; t < TRIES; t++) {
    const z = d.rng.range(-1, 1);
    // Both lanes stay at least 2.6 m wide.
    const hz = d.rng.range(1.2, Math.min(2.4, half - 2.6 - Math.abs(z)));
    const r: Rect = { x: snap(x + d.rng.range(-1, 1)), z: snap(z), hx: snap(d.rng.range(0.6, 0.9)), hz: snap(hz) };
    if (!d.fits(r, 1.2)) continue;
    d.add({ kind: 'spikes', ...r }, r);
    return;
  }
}

/**
 * A row of spike pads across the room at about x. Pads cover most of the
 * width, one sitting on the straight line, and leave at least one gap of
 * MIN_GAP or more, so the row must be steered through, not walked over.
 * A `wide` row leaves a lane about a meter wider: a step between an
 * island and a full row.
 */
export function spikeRow(d: CourseDraft, x: number, wide = false): void {
  const half = d.width / 2;
  const depth = snap(d.rng.range(0.6, 1.1));
  for (let t = 0; t < TRIES; t++) {
    // One open lane, the rest spikes, split into one or two pads either side.
    const lane = wide ? d.rng.range(MIN_GAP + 1, MIN_GAP + 2) : d.rng.range(MIN_GAP + 0.3, MIN_GAP + 1.4);
    const center = d.rng.range(-half + lane / 2 + 1.2, half - lane / 2 - 1.2);
    const pads: Rect[] = [];
    const left = center - lane / 2;
    const right = center + lane / 2;
    // Spikes stop short of the side walls by a step on one side, so there are two ways round when that side is wide.
    const edgeGap = d.rng.chance(0.5) ? 0.2 : MIN_GAP;
    if (left + half > 0.6) pads.push({ x: snap(x), z: snap((-half + edgeGap + left) / 2), hx: depth, hz: snap((left - (-half + edgeGap)) / 2) });
    if (half - right > 0.6) pads.push({ x: snap(x), z: snap((right + half - 0.2) / 2), hx: depth, hz: snap((half - 0.2 - right) / 2) });
    if (pads.length === 0 || pads.some((p) => p.hz < 0.3 || !d.fits(p, 0.6, true))) continue;
    for (const p of pads) d.add({ kind: 'spikes', ...p }, p);
    return;
  }
}

/** A few small spike pads scattered between x0 and x1, as traps among other pieces. */
export function spikeField(d: CourseDraft, x0: number, x1: number, count: number): void {
  let placed = 0;
  for (let t = 0; t < count * TRIES && placed < count; t++) {
    const r: Rect = { x: snap(d.rng.range(x0 + 0.8, x1 - 0.8)), z: snap(d.rng.range(-d.width / 2 + 1, d.width / 2 - 1)), hx: snap(d.rng.range(0.5, 0.9)), hz: snap(d.rng.range(0.5, 1.4)) };
    if (!d.fits(r, MIN_GAP)) continue;
    d.add({ kind: 'spikes', ...r }, r);
    placed++;
  }
}
