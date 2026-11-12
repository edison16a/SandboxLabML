import { describe, expect, it } from 'vitest';
import { STATUS_ARRIVED, STATUS_CRASHED, STATUS_DRIVING } from '@/engine/driving/agent/learner';
import { DRIVING_SNAPSHOT, SNAP } from '@/engine/driving/snapshot';
import { pickLeader, SWITCH_MARGIN } from './leader';

const STRIDE = DRIVING_SNAPSHOT.stride;

/** A snapshot of SUVs given as [progress along the route in m, status]. */
function suvs(...list: Array<[number, number]>): Float32Array {
  const buf = new Float32Array(list.length * STRIDE);
  list.forEach(([progress, status], i) => {
    buf[i * STRIDE + SNAP.progress] = progress;
    buf[i * STRIDE + SNAP.status] = status;
  });
  return buf;
}

/** The camera follows the best SUV, and only moves when another is clearly better. */
describe('picking the SUV to follow', () => {
  it('starts on the furthest SUV still driving', () => {
    expect(pickLeader(suvs([10, STATUS_DRIVING], [50, STATUS_CRASHED], [30, STATUS_DRIVING]), 3, -1)).toBe(2);
  });

  it('keeps the current leader until another SUV is clearly ahead', () => {
    const close = suvs([100, STATUS_DRIVING], [100 + SWITCH_MARGIN - 1, STATUS_DRIVING]);
    expect(pickLeader(close, 2, 0)).toBe(0);
    const clear = suvs([100, STATUS_DRIVING], [100 + SWITCH_MARGIN + 1, STATUS_DRIVING]);
    expect(pickLeader(clear, 2, 0)).toBe(1);
  });

  it('leaves a leader that crashed at once', () => {
    expect(pickLeader(suvs([100, STATUS_CRASHED], [60, STATUS_DRIVING]), 2, 0)).toBe(1);
  });

  it('keeps a leader that arrived until the episode ends', () => {
    expect(pickLeader(suvs([120, STATUS_ARRIVED], [200, STATUS_DRIVING]), 2, 0)).toBe(0);
  });

  it('falls back to the first arrival, then the furthest SUV, once nobody drives', () => {
    expect(pickLeader(suvs([20, STATUS_CRASHED], [70, STATUS_CRASHED]), 2, 0)).toBe(1);
    expect(pickLeader(suvs([90, STATUS_CRASHED], [40, STATUS_ARRIVED]), 2, -1)).toBe(1);
  });
});
