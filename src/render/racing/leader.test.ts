import { describe, expect, it } from 'vitest';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { pickLeader, SWITCH_MARGIN } from './leader';

/** A snapshot of cars given as [progress, stopped]. */
function cars(...list: Array<[number, boolean]>): Float32Array {
  const buf = new Float32Array(list.length * RACING_SNAPSHOT.stride);
  list.forEach(([p, stopped], i) => {
    buf[i * RACING_SNAPSHOT.stride + 6] = stopped ? 1 : 0;
    buf[i * RACING_SNAPSHOT.stride + 7] = p;
  });
  return buf;
}

describe('picking the car to follow', () => {
  it('starts on the furthest car still driving', () => {
    expect(pickLeader(cars([10, false], [50, true], [30, false]), 3, -1)).toBe(2);
  });

  it('keeps the current leader until another car is clearly ahead', () => {
    const close = cars([100, false], [100 + SWITCH_MARGIN - 1, false]);
    expect(pickLeader(close, 2, 0)).toBe(0);
    const clear = cars([100, false], [100 + SWITCH_MARGIN + 1, false]);
    expect(pickLeader(clear, 2, 0)).toBe(1);
  });

  it('leaves a leader that crashed at once', () => {
    expect(pickLeader(cars([100, true], [60, false]), 2, 0)).toBe(1);
  });

  it('falls back to the furthest car once every car has stopped', () => {
    expect(pickLeader(cars([20, true], [70, true]), 2, 0)).toBe(1);
  });
});
