import type { Genome } from '@/engine/neat/types';
import type { LaidOutNode } from './layout';

export interface DrawOptions {
  width: number;
  height: number;
  inputLabels: string[];
  outputLabels: string[];
  /** Live activation per node id, if an agent is being inspected. */
  activity: Map<number, number> | null;
  hoveredInput: number | null;
  /** Inputs switched off by a Sandbox lesion test; their links are drawn struck out in amber. */
  lesioned?: ReadonlySet<number>;
  showDisabled: boolean;
  margin: { left: number; right: number; top: number; bottom: number };
}

const BLUE = [76, 154, 255];
const ORANGE = [255, 159, 67];

function rgba(c: number[], a: number): string {
  return `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`;
}

export function nodePoint(n: LaidOutNode, o: DrawOptions): [number, number] {
  const w = o.width - o.margin.left - o.margin.right;
  const h = o.height - o.margin.top - o.margin.bottom;
  return [o.margin.left + n.x * w, o.margin.top + n.y * h];
}

/**
 * Draws a genome as a layered graph. Blue links are positive weights and
 * orange ones negative, matching the logo. With live activity the links
 * carrying a strong signal light up, so you can watch a decision flow
 * through the network.
 */
export function drawNetwork(g: CanvasRenderingContext2D, genome: Genome, nodes: LaidOutNode[], o: DrawOptions): void {
  g.clearRect(0, 0, o.width, o.height);
  const pos = new Map(nodes.map((n) => [n.id, nodePoint(n, o)]));
  const hoveredId = o.hoveredInput !== null ? genome.inputs[o.hoveredInput] : null;
  const lesionedIds = o.lesioned?.size ? new Set([...o.lesioned].map((i) => genome.inputs[i])) : null;

  for (const c of genome.connections) {
    const a = pos.get(c.from);
    const b = pos.get(c.to);
    if (!a || !b) continue;
    if (!c.enabled && !o.showDisabled) continue;
    const mag = Math.min(1, Math.abs(c.weight) / 3);
    let alpha = 0.18 + 0.5 * mag;
    if (o.activity) alpha = 0.08 + 0.85 * mag * Math.min(1, Math.abs(o.activity.get(c.from) ?? 0));
    if (hoveredId !== null) alpha = c.from === hoveredId ? 0.95 : alpha * 0.25;
    g.beginPath();
    const dx = (b[0] - a[0]) * 0.45;
    g.moveTo(a[0], a[1]);
    g.bezierCurveTo(a[0] + dx, a[1], b[0] - dx, b[1], b[0], b[1]);
    if (c.enabled && lesionedIds?.has(c.from)) {
      // A lesioned input still has its links, but they carry a forced value now.
      g.setLineDash([5, 3]);
      g.strokeStyle = 'rgba(245,196,81,0.9)';
      g.lineWidth = 1.2 + mag * 2;
    } else if (!c.enabled) {
      g.setLineDash([3, 4]);
      g.strokeStyle = 'rgba(138,148,167,0.25)';
      g.lineWidth = 1;
    } else {
      g.setLineDash([]);
      g.strokeStyle = rgba(c.weight >= 0 ? BLUE : ORANGE, alpha);
      g.lineWidth = 0.6 + mag * 2.6;
    }
    g.stroke();
  }
  g.setLineDash([]);

  g.font = '11px var(--font-geist-sans), sans-serif';
  g.textBaseline = 'middle';
  for (const n of nodes) {
    const [x, y] = pos.get(n.id) as [number, number];
    const v = o.activity?.get(n.id) ?? 0;
    const r = n.kind === 'hidden' ? 4.5 : 5.5;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    const intensity = Math.min(1, Math.abs(v));
    g.fillStyle = o.activity ? rgba(v >= 0 ? BLUE : ORANGE, 0.15 + 0.85 * intensity) : '#151a24';
    g.fill();
    g.lineWidth = n.id === hoveredId ? 2.5 : 1.4;
    g.strokeStyle = n.kind === 'bias' ? '#f5c451' : n.kind === 'hidden' ? '#4c9aff' : n.kind === 'output' ? '#e7ebf3' : '#8a94a7';
    g.stroke();
    if (n.kind === 'input' || n.kind === 'bias') {
      const label = n.kind === 'bias' ? 'Bias' : (o.inputLabels[n.slot] ?? `Input ${n.slot + 1}`);
      g.textAlign = 'right';
      g.fillStyle = n.id === hoveredId ? '#ffffff' : lesionedIds?.has(n.id) ? '#f5c451' : '#8a94a7';
      g.fillText(label.length > 17 ? `${label.slice(0, 16)}.` : label, x - 10, y);
    } else if (n.kind === 'output') {
      g.textAlign = 'left';
      g.fillStyle = '#e7ebf3';
      const value = o.activity ? ` ${(o.activity.get(n.id) ?? 0).toFixed(2)}` : '';
      g.fillText(`${o.outputLabels[n.slot] ?? `Out ${n.slot + 1}`}${value}`, x + 10, y);
    }
  }
}
