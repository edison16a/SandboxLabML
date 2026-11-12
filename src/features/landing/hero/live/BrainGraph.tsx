'use client';

import { useLayoutEffect, useMemo, useRef } from 'react';
import { Network } from '@/engine/neat/network';
import { canvasFontFamily } from '@/features/network/canvasFont';
import { NetworkPainter } from '@/features/network/NetworkPainter';
import type { HeroFeed } from '@/render/hero/feed/heroFeed';

interface Props {
  feed: HeroFeed;
  outputLabels: readonly string[];
}

/** Room for the output names and values on the right of the graph, px. Top and bottom stay tight, since a crowded column's dots shrink to fit. */
const MARGIN = { left: 10, right: 104, top: 6, bottom: 6 };

/**
 * A brain lighting up live. After every frame that moved the scene's
 * simulation, the activations of the network that is really driving are
 * copied into the painter's own copy of it and the graph is repainted, so
 * neurons and links glow with the very values that moved the agent. It
 * paints only when the simulation ticked (30 times a second at most) and
 * never while the scene is paused.
 */
export function BrainGraph({ feed, outputLabels }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const genome = feed.genome;
  const mirror = useMemo(() => new Network(genome), [genome]);
  const painter = useMemo(() => new NetworkPainter(genome, mirror, outputLabels), [genome, mirror, outputLabels]);
  const size = useRef({ w: 0, h: 0, dpr: 1 });

  useLayoutEffect(() => {
    const el = canvas.current;
    const g = el?.getContext('2d');
    if (!el || !g) return;
    const paint = () => {
      const { w, h, dpr } = size.current;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      painter.paint(g);
    };
    // Both networks come from one genome, so their values line up slot for slot.
    const think = () => mirror.values.set(feed.brain.values);
    const measure = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = el.clientWidth;
      const h = el.clientHeight;
      size.current = { w, h, dpr };
      el.width = Math.round(w * dpr);
      el.height = Math.round(h * dpr);
      painter.layout({ width: w, height: h, margin: MARGIN });
      paint();
    };
    painter.setFontFamily(canvasFontFamily());
    think();
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const off = feed.onTick(() => {
      think();
      paint();
    });
    return () => {
      ro.disconnect();
      off();
    };
  }, [feed, mirror, painter]);

  return <canvas ref={canvas} className="h-full w-full" aria-hidden="true" />;
}
