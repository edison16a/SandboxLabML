'use client';

import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Network } from '@/engine/neat/network';
import type { Genome } from '@/engine/neat/types';
import { canvasFontFamily } from '@/features/network/canvasFont';
import { NetworkPainter } from '@/features/network/NetworkPainter';
import type { SnapshotStream } from '@/workers/client/snapshotStream';

interface Props {
  genome: Genome;
  outputLabels: readonly string[];
  /** The stream whose inspected agent drives the graph. */
  stream: SnapshotStream;
  /** Which agent of the stream to inspect: the car is 0, a Hide and Seek team is 0 (hider) or 1 (seeker). */
  inspect: number;
}

/** Room for the output names and values on the right of the graph, px. Top and bottom stay tight, since a crowded column's dots shrink to fit. */
const MARGIN = { left: 10, right: 104, top: 6, bottom: 6 };

/**
 * A brain lighting up live. Each time the worker sends a frame, the
 * inspected agent's inputs run through a local copy of its network and
 * the graph is repainted, so neurons and links glow with the very values
 * that moved the agent. It paints only when a frame arrives, at most 30
 * times a second, and never while the scene is paused.
 */
export function BrainGraph({ genome, outputLabels, stream, inspect }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const net = useMemo(() => new Network(genome), [genome]);
  const painter = useMemo(() => new NetworkPainter(genome, net, outputLabels), [genome, net, outputLabels]);
  const size = useRef({ w: 0, h: 0, dpr: 1 });

  useEffect(() => {
    stream.subscribe(inspect, false);
    // Unsubscribed, the worker stops copying inputs into every frame.
    return () => stream.subscribe(null, false);
  }, [stream, inspect]);

  useLayoutEffect(() => {
    const el = canvas.current;
    const g = el?.getContext('2d');
    if (!el || !g) return;
    const out = new Float64Array(genome.outputs.length);
    // Runs the newest inputs through the network. The stream keeps the last ones it got, so a graph that
    // mounts while its scene is paused lights up from where the agent left off instead of showing a blank brain.
    const think = () => {
      const obs = stream.inspect;
      if (!obs || obs.index !== inspect || obs.obs.length < genome.inputs.length) return false;
      net.activate(obs.obs, out);
      return true;
    };
    const paint = () => {
      const { w, h, dpr } = size.current;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      painter.paint(g);
    };
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
    const off = stream.on((msg) => {
      if (msg.kind === 'frame' && think()) paint();
    });
    return () => {
      ro.disconnect();
      off();
    };
  }, [genome, net, painter, stream, inspect]);

  return <canvas ref={canvas} className="h-full w-full" aria-hidden="true" />;
}
