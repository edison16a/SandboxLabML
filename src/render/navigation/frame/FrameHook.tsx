'use client';

import { useFrame } from '@react-three/fiber';
import { DRIVER_PRIORITY } from './sceneContext';

/** Calls `onFrame` with the wall time step before the frame driver reads the feed, so a feed advanced here is drawn the same frame. */
export function FrameHook({ onFrame }: { onFrame: (dt: number) => void }) {
  useFrame((_, dt) => onFrame(dt), DRIVER_PRIORITY - 1);
  return null;
}
