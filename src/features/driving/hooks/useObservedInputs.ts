'use client';

import { useEffect, useMemo } from 'react';
import type { Observation, ObservedInputs } from '@/render/driving/frame/observed';
import type { SnapshotStream } from '@/workers/client/snapshotStream';

/**
 * Keeps the latest two observations the shown stream carried for the
 * inspected SUV, each with the tick of its frame, so the overlay can draw
 * the lidar its brain read and blend it like the pose. One object for the
 * page's life, filled as frames arrive: the two slots swap places rather
 * than being made anew, and a new episode empties them.
 */
export function useObservedInputs(stream: SnapshotStream | null): ObservedInputs {
  const state = useMemo(() => {
    const slots: [Observation, Observation] = [
      { index: -1, tick: -1, obs: new Float32Array(0) },
      { index: -1, tick: -1, obs: new Float32Array(0) },
    ];
    return { observed: { prev: null, curr: null } as ObservedInputs, slots, next: 0 };
  }, []);
  useEffect(() => {
    const { observed, slots } = state;
    observed.prev = observed.curr = null;
    if (!stream) return;
    return stream.on((msg) => {
      if (msg.kind === 'start') observed.prev = observed.curr = null;
      if (msg.kind !== 'frame' || !msg.inspect) return;
      const slot = slots[state.next];
      state.next = 1 - state.next;
      slot.index = msg.inspect.index;
      slot.tick = msg.tick;
      slot.obs = msg.inspect.obs;
      observed.prev = observed.curr;
      observed.curr = slot;
    });
  }, [stream, state]);
  return state.observed;
}
