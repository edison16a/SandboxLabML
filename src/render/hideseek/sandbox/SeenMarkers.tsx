'use client';

import { Suspense, useCallback } from 'react';
import { FLAG_SEEN } from '@/engine/hideseek/snapshot';
import { hasFlag } from '../frame/snapshotRead';
import { SeenWord, type SeenReader } from '../showcase/SeenBillboard';
import { readPlayer, sandboxFrame } from './sandboxRead';

/** The showcase SEEN word over one Sandbox hider, read from the Sandbox frame by slot. A little smaller, since several can show at once. */
function SeenMarker({ slot }: { slot: number }) {
  const read = useCallback<SeenReader>(
    (frame, out) => {
      const curr = sandboxFrame(frame);
      return !!curr && hasFlag(readPlayer(frame, curr, slot, out), FLAG_SEEN);
    },
    [slot],
  );
  return <SeenWord read={read} scale={0.85} />;
}

/** A SEEN marker for every hider. */
export function SeenMarkers({ hiders }: { hiders: number }) {
  return (
    <Suspense fallback={null}>
      {Array.from({ length: hiders }, (_, i) => (
        <SeenMarker key={i} slot={i} />
      ))}
    </Suspense>
  );
}
