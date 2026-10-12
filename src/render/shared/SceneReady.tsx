'use client';

import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

/** How often the probe checks, ms, and how long it waits for a frame before trusting the data alone. */
const POLL = 100;
const NO_FRAME_GRACE = 600;

interface Props {
  /** True once the scene has what its finished picture needs. */
  isReady: () => boolean;
  /** Called with true once the ready scene has drawn, and with false if it stops being ready. */
  onChange: (ready: boolean) => void;
}

/**
 * Tells the page when the 3D scene in its canvas is really showing. Data
 * arriving is not enough: the frame that draws it has to render too, or a
 * cover would lift on a half built picture. A canvas whose loop is held
 * draws nothing, so after a short grace the data alone counts.
 */
export function SceneReady({ isReady, onChange }: Props) {
  const drawn = useRef(0);
  useFrame(() => void drawn.current++);
  useEffect(() => {
    let ready = false;
    let since = -1;
    let seenAt = 0;
    const id = setInterval(() => {
      const now = performance.now();
      if (!isReady()) {
        since = -1;
        if (ready) onChange((ready = false));
        return;
      }
      if (since < 0) {
        since = now;
        seenAt = drawn.current;
      }
      // Two frames after the data is in, the picture on screen has it.
      if (!ready && (drawn.current - seenAt >= 2 || now - since > NO_FRAME_GRACE)) onChange((ready = true));
    }, POLL);
    return () => clearInterval(id);
  }, [isReady, onChange]);
  return null;
}
