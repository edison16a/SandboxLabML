'use client';

import { useEffect, useState, type RefObject } from 'react';
import { fitsFrame, heroLayout } from '@/render/hero/stage/framedLayout';
import { POSTER_FRAMES, type PosterFrame } from '@/render/hero/stage/posterFrame';
import type { Pane, Rect, SplitLayout } from '@/render/hero/stage/splitLayout';
import { posterFrameKind } from '../posterMedia';

/** The split the scenes draw with, and the poster frame its shots follow (null when the hero frames itself). */
export interface HeroSplit {
  layout: SplitLayout;
  frame: PosterFrame | null;
}

const sameRect = (a: Rect, b: Rect) => Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3 && Math.abs(a.w - b.w) < 1e-3 && Math.abs(a.h - b.h) < 1e-3;

function samePane(p: Pane, q: Pane): boolean {
  if (!sameRect(p.rect, q.rect) || !sameRect(p.view, q.view) || p.shot.w !== q.shot.w || p.shot.h !== q.shot.h) return false;
  return Math.abs(p.focusX - q.focusX) < 1e-3 && Math.abs(p.focusY - q.focusY) < 1e-3 && Math.abs(p.zoneW - q.zoneW) < 1e-3 && Math.abs(p.zoneH - q.zoneH) < 1e-3;
}

/** Whether two splits would draw the same, so a resize that changes nothing re-renders nothing. */
function same(a: HeroSplit | null, b: HeroSplit): boolean {
  return !!a && a.frame === b.frame && a.layout.stacked === b.layout.stacked && samePane(a.layout.drive, b.layout.drive) && samePane(a.layout.run, b.layout.run);
}

/**
 * Measures the hero and its text panel and splits the hero between the two
 * scenes (see heroLayout): composed like the poster frame under them where
 * the window's shape allows, else around the measured panel. It measures
 * again whenever either one resizes, so the panes and the subjects follow
 * the window and the text's wrapping.
 */
export function useSplitLayout(hero: RefObject<HTMLElement | null>, panel: RefObject<HTMLElement | null>): HeroSplit | null {
  const [split, setSplit] = useState<HeroSplit | null>(null);

  useEffect(() => {
    const el = hero.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const p = panel.current?.getBoundingClientRect();
      const rect = p ? { x: p.left - box.left, y: p.top - box.top, w: p.width, h: p.height } : null;
      const width = Math.round(box.width);
      const height = Math.round(box.height);
      const poster = POSTER_FRAMES[posterFrameKind((q) => window.matchMedia(q).matches)];
      const frame = fitsFrame(poster, width, height) ? poster : null;
      const next = { layout: heroLayout(width, height, frame, rect), frame };
      setSplit((prev) => (same(prev, next) ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (panel.current) ro.observe(panel.current);
    return () => ro.disconnect();
  }, [hero, panel]);

  return split;
}
