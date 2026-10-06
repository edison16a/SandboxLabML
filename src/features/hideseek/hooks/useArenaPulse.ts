'use client';

import { useEffect, useState } from 'react';
import { STRIDE } from '@/render/hideseek/frame/snapshotRead';
import { hideSeekSession } from '../session/HideSeekSession';
import { useHideSeekLab } from '../state/hideSeekStore';

/** What the HUD shows about the arenas on screen, sampled a few times a second. */
export interface ArenaPulse {
  arenas: number;
  /** Match time of the inspected arena, s, and whether it is still in prep. */
  time: number;
  prep: boolean;
  /** Arenas in the seek phase, and how many of their hiders are out of sight right now. */
  seeking: number;
  hidden: number;
}

const EMPTY: ArenaPulse = { arenas: 0, time: 0, prep: true, seeking: 0, hidden: 0 };

/**
 * Samples the feed the viewport shows four times a second. The HUD does
 * not need 60 updates a second, and reading the latest buffer here keeps
 * React out of the render loop entirely.
 */
export function useArenaPulse(): ArenaPulse {
  const [pulse, setPulse] = useState<ArenaPulse>(EMPTY);
  useEffect(() => {
    const id = setInterval(() => {
      const feed = hideSeekSession().feed();
      const buf = feed?.curr?.buffer;
      if (!feed || !buf || feed.count === 0) return setPulse(EMPTY);
      const s = useHideSeekLab.getState();
      const n = s.mode === 'sandbox' ? 1 : Math.min(feed.count, s.gridSize === 1 ? feed.count : s.gridSize);
      let seeking = 0;
      let hidden = 0;
      for (let i = 0; i < n; i++) {
        if (buf[i * STRIDE + 1] === 1) continue;
        seeking++;
        if (buf[i * STRIDE + 2] === 0) hidden++;
      }
      const a = Math.min(feed.count - 1, s.focus ?? 0) * STRIDE;
      setPulse({ arenas: n, time: buf[a], prep: buf[a + 1] === 1, seeking, hidden });
    }, 250);
    return () => clearInterval(id);
  }, []);
  return pulse;
}
