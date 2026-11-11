'use client';

import { useEffect, useMemo } from 'react';
import type { ObservedInputs } from '@/render/driving/frame/observed';
import type { SnapshotStream } from '@/workers/client/snapshotStream';

/**
 * Keeps the latest two observations the shown stream carried for the
 * inspected SUV, each with the tick of its frame, so the overlay can draw
 * the lidar its brain read and blend it like the pose. One object for the
 * page's life, filled as frames arrive; a new episode starts it over.
 */
export function useObservedInputs(stream: SnapshotStream | null): ObservedInputs {
  const observed = useMemo<ObservedInputs>(() => ({ prev: null, curr: null }), []);
  useEffect(() => {
    observed.prev = observed.curr = null;
    if (!stream) return;
    return stream.on((msg) => {
      if (msg.kind === 'start') observed.prev = observed.curr = null;
      if (msg.kind !== 'frame' || !msg.inspect) return;
      observed.prev = observed.curr;
      observed.curr = { index: msg.inspect.index, tick: msg.tick, obs: msg.inspect.obs };
    });
  }, [stream, observed]);
  return observed;
}
