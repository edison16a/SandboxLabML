import { STATUS_ARRIVED, STATUS_DRIVING } from '@/engine/driving/agent/learner';
import { DRIVING_SNAPSHOT, SNAP } from '@/engine/driving/snapshotLayout';

const STRIDE = DRIVING_SNAPSHOT.stride;

/** The SUVs of a Sandbox trip: how many line up, how many still drive and how many arrived. */
export interface TripCount {
  total: number;
  driving: number;
  arrived: number;
}

export const NO_TRIP: TripCount = { total: 0, driving: 0, arrived: 0 };

/** The parts of the ghost stream a count reads: how many SUVs it carries and its latest frame, if one came yet. */
export interface TripStream {
  count: number;
  curr: { buffer: Float32Array } | null;
}

/**
 * The trip's count from the ghost stream, or `last` while there is
 * nothing new to read. The replay starts a finished trip over on its
 * own, and each new run announces its SUVs just before its lineup frame
 * lands. Read as nothing, that moment made the bar say there was nothing
 * to drive right after every SUV arrived. Only a stream with no SUVs at
 * all (no lineup, or a scene being swapped) counts as empty.
 */
export function readTrip(stream: TripStream | null, last: TripCount): TripCount {
  if (!stream || stream.count === 0) return NO_TRIP;
  const buf = stream.curr?.buffer;
  // A run that has not sent a frame yet: its SUVs are all at the start, unless the count before it still stands.
  if (!buf) return last.total === stream.count ? last : { total: stream.count, driving: stream.count, arrived: 0 };
  let driving = 0;
  let arrived = 0;
  for (let i = 0; i < stream.count; i++) {
    const status = buf[i * STRIDE + SNAP.status];
    if (status === STATUS_DRIVING) driving++;
    else if (status === STATUS_ARRIVED) arrived++;
  }
  return last.total === stream.count && last.driving === driving && last.arrived === arrived ? last : { total: stream.count, driving, arrived };
}

/** Every SUV has stopped: they arrived, crashed or ran out of time, and the trip is over until it starts again. */
export function tripOver(trip: TripCount): boolean {
  return trip.total > 0 && trip.driving === 0;
}
