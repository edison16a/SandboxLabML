'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

/** How long a change keeps an idle canvas drawing, ms: long enough for a camera flight to land and new meshes to show. */
const AWAKE_MS = 2500;

/**
 * Keeps an idle (draw on demand) canvas drawing for a moment whenever one
 * of `keys` changes: a new camera view has a flight to play, a new course
 * meshes to show, a toggle an overlay to draw. A live canvas draws anyway,
 * so this costs nothing there.
 */
export function WakeOnChange({ keys }: { keys: readonly unknown[] }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const until = performance.now() + AWAKE_MS;
    let raf = requestAnimationFrame(function tick() {
      invalidate();
      if (performance.now() < until) raf = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(raf);
    // The keys are the dependencies: any change among them wakes the canvas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidate, ...keys]);
  return null;
}
