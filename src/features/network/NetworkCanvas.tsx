'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Network } from '@/engine/neat/network';
import type { Genome } from '@/engine/neat/types';
import { drawNetwork, nodePoint, type DrawOptions } from './drawNetwork';
import { layoutGenome } from './layout';

interface Props {
  genome: Genome;
  inputLabels: string[];
  outputLabels: string[];
  /** Returns the latest observation of the inspected agent, or null. */
  liveObservation?: () => Float32Array | null;
  hoveredInput: number | null;
  onHoverInput: (index: number | null) => void;
  showDisabled: boolean;
}

const MARGIN = { left: 128, right: 84, top: 16, bottom: 16 };

/**
 * The network graph on a 2D canvas. When an agent is inspected, its current
 * observation is run through a local copy of the network every frame so the
 * graph shows live activations. Hovering an input links to its ray in 3D.
 */
export function NetworkCanvas({ genome, inputLabels, outputLabels, liveObservation, hoveredInput, onHoverInput, showDisabled }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const nodes = useMemo(() => layoutGenome(genome), [genome]);
  const net = useMemo(() => new Network(genome), [genome]);
  const [size, setSize] = useState({ w: 360, h: 420 });
  const hovered = useRef(hoveredInput);
  hovered.current = hoveredInput;

  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const el = canvas.current;
    const g = el?.getContext('2d');
    if (!el || !g) return;
    const dpr = window.devicePixelRatio || 1;
    el.width = size.w * dpr;
    el.height = size.h * dpr;
    const out = new Float64Array(genome.outputs.length);
    let raf = 0;
    const render = () => {
      const obs = liveObservation?.() ?? null;
      let activity: Map<number, number> | null = null;
      if (obs && obs.length >= genome.inputs.length) {
        net.activate(obs, out);
        activity = new Map();
        for (let i = 0; i < net.nodeIds.length; i++) activity.set(net.nodeIds[i], net.values[i]);
      }
      const o: DrawOptions = { width: size.w, height: size.h, inputLabels, outputLabels, activity, hoveredInput: hovered.current, showDisabled, margin: MARGIN };
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      drawNetwork(g, genome, nodes, o);
      raf = requestAnimationFrame(render);
    };
    raf = requestAnimationFrame(render);
    return () => cancelAnimationFrame(raf);
  }, [genome, nodes, net, size, inputLabels, outputLabels, liveObservation, showDisabled]);

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const py = e.clientY - rect.top;
    const o = { width: size.w, height: size.h, margin: MARGIN } as DrawOptions;
    let best: number | null = null;
    let bestD = 14 * 14;
    for (const n of nodes) {
      if (n.kind !== 'input') continue;
      const [x, y] = nodePoint(n, o);
      const d = (x - px) ** 2 + (y - py) ** 2;
      // Labels sit to the left of input nodes, so count a hover over the label too.
      const onLabel = px < x && px > x - MARGIN.left + 8 && Math.abs(py - y) < 7;
      if (d < bestD || onLabel) {
        bestD = onLabel ? 0 : d;
        best = n.slot;
      }
    }
    if (best !== hoveredInput) onHoverInput(best);
  };

  return (
    <canvas
      ref={canvas}
      className="h-full w-full"
      onPointerMove={onMove}
      onPointerLeave={() => onHoverInput(null)}
      role="img"
      aria-label={`Network with ${genome.nodes.length} neurons and ${genome.connections.filter((c) => c.enabled).length} active connections`}
    />
  );
}
