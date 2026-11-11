'use client';

import { useEffect, useState } from 'react';
import type { DrivingContent } from '@/engine/driving/run/content';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { useDrivingLab } from '../state/labStore';
import type { StreamFrames } from '../session/frames';

/**
 * The content the live generation on screen drives. The coordinator sends
 * the next generation's content as soon as the last one ends, a moment
 * before that generation starts streaming, so the content is taken when
 * the stream announces a new episode. Until then it is the live content.
 */
export function usePopulationContent(stream: SnapshotStream | null): DrivingContent | null {
  const live = useDrivingLab((s) => s.content);
  const [latched, setLatched] = useState<DrivingContent | null>(null);
  useEffect(() => {
    if (!stream) return;
    return stream.on((msg) => {
      if (msg.kind === 'start') setLatched(useDrivingLab.getState().content);
    });
  }, [stream]);
  // A run that just opened has no episode streamed yet: its live content is the one to show.
  return stream?.curr && latched ? latched : live;
}

/**
 * Keeps the store's trip on screen in step with the shown stream. It
 * checks each frame as it arrives, so the route on the road changes on the
 * same frame the SUVs jump to the next start.
 */
export function useTripOnScreen(frames: StreamFrames | null) {
  useEffect(() => {
    if (!frames) return;
    const sync = () => {
      const trip = frames.trip();
      const trips = frames.trips();
      const s = useDrivingLab.getState();
      if (s.trip !== trip || s.trips !== trips) s.set({ trip, trips });
    };
    sync();
    return frames.stream.on((msg) => {
      if (msg.kind === 'frame' || msg.kind === 'start') sync();
    });
  }, [frames]);
}
