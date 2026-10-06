import { hashObject } from '../core/hash';
import { CHECKPOINT_SPACING, type Track } from '../racing/track/types';

/** A copy of `src` read starting at sample `shift`, so index 0 lands on the old sample `shift`. */
function rotate(src: Float64Array, shift: number): Float64Array {
  const out = new Float64Array(src.length);
  for (let i = 0; i < src.length; i++) out[i] = src[(i + shift) % src.length];
  return out;
}

/**
 * The same road with its start line moved `fraction` of a lap forward.
 * Cars always start at sample 0, so the benchmark rotates every per-sample
 * array instead of teaching the car runtime about start positions. Edges,
 * curvature and the ray grid describe the same geometry, so the grid is
 * shared. Checkpoints are laid out from the new start exactly the way
 * buildTrack lays them out from the old one.
 */
export function startAt(track: Track, fraction: number): Track {
  const shift = ((Math.round(fraction * track.count) % track.count) + track.count) % track.count;
  if (shift === 0) return track;
  const perCheckpoint = Math.max(1, Math.round(CHECKPOINT_SPACING / track.spacing));
  return {
    ...track,
    cx: rotate(track.cx, shift),
    cy: rotate(track.cy, shift),
    tx: rotate(track.tx, shift),
    ty: rotate(track.ty, shift),
    curvature: rotate(track.curvature, shift),
    s: Float64Array.from({ length: track.count }, (_, i) => i * track.spacing),
    leftX: rotate(track.leftX, shift),
    leftY: rotate(track.leftY, shift),
    rightX: rotate(track.rightX, shift),
    rightY: rotate(track.rightY, shift),
    checkpoints: Int32Array.from({ length: Math.floor(track.count / perCheckpoint) }, (_, k) => k * perCheckpoint),
    hash: hashObject({ track: track.hash, start: shift }),
  };
}
