'use client';

import { useEffect, useRef } from 'react';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { arenaHiderSeen, arenaInPrep } from '@/render/hideseek/frame/snapshotRead';
import { hideSeekSession } from '../../session/HideSeekSession';
import { useHideSeekLab } from '../../state/hideSeekStore';

/** Bars across one match: two a second over the 30 s match. */
const BINS = 60;
const MATCH_SECONDS = DEFAULT_HIDESEEK_PHYSICS.matchSeconds;
const PREP_SHARE = DEFAULT_HIDESEEK_PHYSICS.prepShare;
const HIDER = '#4c9aff';
const SEEKER = '#ff5f6d55';

/**
 * A strip above the grid: for each moment of the match so far, how many of
 * the hiders on screen were out of sight. Blue bars grow up from the
 * middle line (hidden), faint red ones down (seen), so a round where hiders
 * learn to shelter fills with blue as it goes. Drawn on a canvas a few
 * times a second.
 */
export function HiddenHistogram() {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const hidden = new Float32Array(BINS).fill(-1);
    const seen = new Float32Array(BINS);
    let epoch = Number.NaN;
    const id = setInterval(() => {
      const el = canvas.current;
      const feed = hideSeekSession().feed();
      const buf = feed?.curr?.buffer;
      const g = el?.getContext('2d');
      if (!el || !g || !feed || !buf) return;
      const s = useHideSeekLab.getState();
      const n = Math.min(feed.count, s.gridSize);
      if (feed.epoch !== epoch) {
        epoch = feed.epoch;
        hidden.fill(-1);
      }
      const time = buf[0];
      const bin = Math.min(BINS - 1, Math.floor((time / MATCH_SECONDS) * BINS));
      if (time < 0.05) hidden.fill(-1);
      let h = 0;
      let k = 0;
      for (let i = 0; i < n; i++) {
        if (arenaInPrep(buf, i)) continue;
        k++;
        if (!arenaHiderSeen(buf, i)) h++;
      }
      if (k > 0) {
        hidden[bin] = h / n;
        seen[bin] = (k - h) / n;
      }
      const dpr = window.devicePixelRatio || 1;
      const w = el.clientWidth;
      const ht = el.clientHeight;
      if (el.width !== w * dpr) el.width = w * dpr;
      if (el.height !== ht * dpr) el.height = ht * dpr;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, ht);
      const mid = ht * 0.62;
      const bw = w / BINS;
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(0, 0, bw * BINS * PREP_SHARE, ht);
      for (let b = 0; b < BINS; b++) {
        if (hidden[b] < 0) continue;
        g.fillStyle = b === bin ? '#9cc6ff' : HIDER;
        g.fillRect(b * bw + 1, mid - hidden[b] * (mid - 2), bw - 2, hidden[b] * (mid - 2));
        g.fillStyle = SEEKER;
        g.fillRect(b * bw + 1, mid + 1, bw - 2, seen[b] * (ht - mid - 2));
      }
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(0, mid, w, 1);
    }, 200);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="pointer-events-none flex w-[min(460px,40vw)] flex-col gap-1 rounded-md border border-white/10 bg-black/45 px-2.5 py-1.5 backdrop-blur-sm">
      <div className="flex items-baseline justify-between text-[10px] font-medium tracking-wide text-white/60 uppercase">
        <span>Hidden over the match</span>
        <span className="normal-case">prep shaded</span>
      </div>
      <canvas ref={canvas} className="h-10 w-full" aria-label="How many hiders are hidden at each moment of the match" role="img" />
    </div>
  );
}
