import { describe, expect, it } from 'vitest';
import { WORLD_TRIP, WORLD_TRIPS } from '@/engine/driving/run/tripHeader';
import { DRIVING_SNAPSHOT, WORLD_SIZE } from '@/engine/driving/snapshot';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { StreamFrames } from './frames';
import { focusIndex, pickedFocus, shownStream } from './shown';

const COUNT = 3;
const OFFSET = COUNT * DRIVING_SNAPSHOT.stride;

function frame(trip: number, tick: number) {
  const buffer = new Float32Array(OFFSET + WORLD_SIZE);
  buffer[OFFSET + WORLD_TRIP] = trip;
  buffer[OFFSET + WORLD_TRIPS] = 3;
  return { buffer, tick, at: tick };
}

/** Just the parts of a SnapshotStream the adapter reads. */
function stream(prevTrip: number, currTrip: number): SnapshotStream {
  return { prev: frame(prevTrip, 1), curr: frame(currTrip, 2), count: COUNT, tags: new Int32Array(COUNT), world: WORLD_SIZE, epoch: 4, alpha: () => 0.5, on: () => () => {} } as unknown as SnapshotStream;
}

describe('StreamFrames', () => {
  it('reads the world after the SUVs and the trip from its header', () => {
    const f = new StreamFrames(stream(1, 1));
    expect(f.worldOffset).toBe(OFFSET);
    expect(f.trip()).toBe(1);
    expect(f.trips()).toBe(3);
    expect(f.prev).not.toBeNull();
  });

  it('treats a new trip as a new episode: nothing to blend from, a new epoch', () => {
    const same = new StreamFrames(stream(0, 0));
    const next = new StreamFrames(stream(0, 1));
    expect(next.prev).toBeNull();
    expect(next.epoch).not.toBe(same.epoch);
  });

  it('goes dark while the stream it matches shows another trip', () => {
    const over = new StreamFrames(stream(2, 2));
    over.match = new StreamFrames(stream(1, 1));
    expect(over.count).toBe(0);
    expect(over.curr).toBeNull();
    over.match = new StreamFrames(stream(2, 2));
    expect(over.count).toBe(COUNT);
  });
});

describe('the stream on screen', () => {
  it('shows the live generation only at watch speeds in training', () => {
    expect(shownStream({ mode: 'train', view: 'both', speed: '1x' })).toBe('population');
    expect(shownStream({ mode: 'train', view: 'both', speed: 'turbo' })).toBe('ghosts');
    expect(shownStream({ mode: 'train', view: 'overlay', speed: '2x' })).toBe('ghosts');
    expect(shownStream({ mode: 'sandbox', view: 'population', speed: '1x' })).toBe('ghosts');
  });

  it('follows a picked SUV only in the stream it was picked in', () => {
    expect(focusIndex({ kind: 'agent', index: 4 }, 'population', [])).toBe(4);
    expect(focusIndex({ kind: 'agent', index: 4 }, 'ghosts', [])).toBe(-1);
    expect(focusIndex({ kind: 'ghost', generation: 7 }, 'ghosts', [0, 3, 7])).toBe(2);
    expect(pickedFocus(2, 'ghosts', [0, 3, 7])).toEqual({ kind: 'ghost', generation: 7 });
    expect(pickedFocus(5, 'population', [])).toEqual({ kind: 'agent', index: 5 });
  });
});
