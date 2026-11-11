'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { FRAME_PRIORITY } from './FrameDriver';
import { useDrivingScene } from './sceneContext';

/**
 * Tells the page which SUV the camera follows, only when that changes. The
 * lab streams the inputs of exactly this one, so the inputs panel and the
 * network show the car on screen rather than whoever leads in the worker.
 */
export function FocusReporter({ onFocus }: { onFocus: (index: number) => void }) {
  const { frame } = useDrivingScene();
  const last = useRef(-2);
  useFrame(() => {
    if (frame.focus === last.current) return;
    last.current = frame.focus;
    onFocus(frame.focus);
  }, FRAME_PRIORITY.overlay);
  return null;
}
