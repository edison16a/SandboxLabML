'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { SANDBOX_PHASE, SANDBOX_TIME } from '@/engine/hideseek/sandbox/snapshot';
import { useHsScene } from '@/render/hideseek/frame/sceneContext';
import { latticeFor } from '@/render/hideseek/layout/gridLattice';

/** Frames drawn with players on the floor before the scene counts as shown. */
const SETTLE_FRAMES = 4;

/**
 * Runs first every frame and fills the shared Hide and Seek frame from the
 * Sandbox stream: one arena, always focused, at the origin. The lab's
 * frame driver does the same from its store, which the landing page must
 * never touch.
 */
export function HeroArenaDriver({ onShown }: { onShown: () => void }) {
  const { frame, getFeed } = useHsScene();
  const size = useThree((s) => s.size);
  const aspect = size.width / Math.max(1, size.height);
  // One arena fills a 1 x 1 lattice whatever the aspect, but the lattice is rebuilt only when the size changes.
  const lattice = useMemo(() => latticeFor(1, aspect), [aspect]);
  const drawn = useRef(0);

  useFrame(() => {
    const feed = getFeed();
    const curr = feed?.curr;
    frame.count = 1;
    frame.first = 0;
    frame.focusSlot = 0;
    frame.dim = 1;
    if (frame.lattice !== lattice) {
      frame.lattice = lattice;
      frame.version++;
    }
    if (!feed || !curr) {
      frame.preview = true;
      frame.curr = frame.prev = null;
      return;
    }
    frame.feed = feed;
    frame.preview = false;
    frame.curr = curr.buffer;
    frame.prev = feed.prev?.buffer ?? null;
    frame.alpha = feed.alpha();
    frame.epoch = feed.epoch;
    frame.matchTime = curr.buffer[SANDBOX_TIME];
    frame.prep = curr.buffer[SANDBOX_PHASE] === 1;
    if (drawn.current < SETTLE_FRAMES && ++drawn.current === SETTLE_FRAMES) onShown();
  }, -2);
  return null;
}
