import { describe, expect, it } from 'vitest';
import { STATUS_ARRIVED, STATUS_CRASHED, STATUS_DRIVING } from '@/engine/driving/agent/learner';
import { DRIVING_SNAPSHOT, SNAP } from '@/engine/driving/snapshotLayout';
import { NO_TRIP, readTrip, tripOver, type TripStream } from './tripCount';

/** A ghost stream frame with these statuses, one per SUV. */
function frame(statuses: number[]): TripStream {
  const buffer = new Float32Array(statuses.length * DRIVING_SNAPSHOT.stride);
  statuses.forEach((s, i) => (buffer[i * DRIVING_SNAPSHOT.stride + SNAP.status] = s));
  return { count: statuses.length, curr: { buffer } };
}

describe('the Sandbox trip count', () => {
  it('counts the SUVs still driving and those that arrived', () => {
    expect(readTrip(frame([STATUS_DRIVING, STATUS_ARRIVED, STATUS_CRASHED]), NO_TRIP)).toEqual({ total: 3, driving: 1, arrived: 1 });
  });

  it('shows the finished trip, not an empty one, while the replay starts it over', () => {
    const done = readTrip(frame([STATUS_ARRIVED, STATUS_ARRIVED, STATUS_ARRIVED]), NO_TRIP);
    expect(done).toEqual({ total: 3, driving: 0, arrived: 3 });
    expect(tripOver(done)).toBe(true);
    // The new run announces its three SUVs before its first frame.
    const restarting = readTrip({ count: 3, curr: null }, done);
    expect(restarting).toBe(done);
    expect(readTrip(frame([STATUS_DRIVING, STATUS_DRIVING, STATUS_DRIVING]), restarting)).toEqual({ total: 3, driving: 3, arrived: 0 });
  });

  it('puts a new lineup at the start until its first frame', () => {
    const before = { total: 3, driving: 1, arrived: 2 };
    expect(readTrip({ count: 4, curr: null }, before)).toEqual({ total: 4, driving: 4, arrived: 0 });
  });

  it('is empty only when the stream carries no SUVs', () => {
    expect(readTrip(null, { total: 3, driving: 0, arrived: 3 })).toBe(NO_TRIP);
    expect(readTrip({ count: 0, curr: null }, { total: 3, driving: 0, arrived: 3 })).toBe(NO_TRIP);
    expect(tripOver(NO_TRIP)).toBe(false);
  });

  it('keeps the same object while nothing changed, so the bar does not render again', () => {
    const last = readTrip(frame([STATUS_DRIVING, STATUS_ARRIVED]), NO_TRIP);
    expect(readTrip(frame([STATUS_DRIVING, STATUS_ARRIVED]), last)).toBe(last);
  });
});
