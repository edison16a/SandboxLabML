'use client';

import { useEffect, useState, type RefObject } from 'react';
import { splitLayout, type SplitLayout } from '@/render/hero/stage/splitLayout';

/** Whether two layouts would draw the same, so a resize that changes nothing re-renders nothing. */
function same(a: SplitLayout | null, b: SplitLayout): boolean {
  if (!a || a.stacked !== b.stacked) return false;
  for (const k of ['car', 'arena'] as const) {
    const p = a[k];
    const q = b[k];
    if (p.rect.x !== q.rect.x || p.rect.y !== q.rect.y || p.rect.w !== q.rect.w || p.rect.h !== q.rect.h) return false;
    if (Math.abs(p.focusX - q.focusX) > 1e-3 || Math.abs(p.focusY - q.focusY) > 1e-3 || Math.abs(p.zoneW - q.zoneW) > 1e-3 || Math.abs(p.zoneH - q.zoneH) > 1e-3) return false;
  }
  return true;
}

/**
 * Measures the hero and its text panel and splits the hero between the two
 * scenes (see splitLayout). It measures again whenever either one resizes,
 * so the panes and the subjects follow the window and the text's wrapping.
 */
export function useSplitLayout(hero: RefObject<HTMLElement | null>, panel: RefObject<HTMLElement | null>): SplitLayout | null {
  const [layout, setLayout] = useState<SplitLayout | null>(null);

  useEffect(() => {
    const el = hero.current;
    if (!el) return;
    const measure = () => {
      const box = el.getBoundingClientRect();
      const p = panel.current?.getBoundingClientRect();
      const rect = p ? { x: p.left - box.left, y: p.top - box.top, w: p.width, h: p.height } : null;
      const next = splitLayout(Math.round(box.width), Math.round(box.height), rect);
      setLayout((prev) => (same(prev, next) ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    if (panel.current) ro.observe(panel.current);
    return () => ro.disconnect();
  }, [hero, panel]);

  return layout;
}
