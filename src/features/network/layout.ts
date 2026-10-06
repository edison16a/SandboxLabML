import { topologicalOrder } from '@/engine/neat/network';
import type { Genome } from '@/engine/neat/types';

export interface LaidOutNode {
  id: number;
  kind: 'input' | 'bias' | 'output' | 'hidden';
  /** 0 to 1 across the canvas, inputs at 0 and outputs at 1. */
  x: number;
  /** 0 to 1 down the canvas. */
  y: number;
  /** Index in the observation or action vector, for labels. */
  slot: number;
}

/**
 * Places neurons in columns: inputs left, outputs right, and each hidden
 * neuron at its depth (longest path from an input). Inside a column, nodes
 * are sorted by the average height of their sources, which removes most edge
 * crossings without a full graph layout library.
 */
export function layoutGenome(g: Genome): LaidOutNode[] {
  const order = topologicalOrder(g);
  const depth = new Map<number, number>();
  for (const id of [...g.inputs, g.biasId]) depth.set(id, 0);
  const incoming = new Map<number, number[]>();
  for (const c of g.connections) {
    if (!c.enabled) continue;
    const list = incoming.get(c.to) ?? [];
    list.push(c.from);
    incoming.set(c.to, list);
  }
  const outputs = new Set(g.outputs);
  let maxDepth = 1;
  for (const id of order) {
    if (outputs.has(id)) continue;
    const d = 1 + Math.max(0, ...(incoming.get(id) ?? []).map((s) => depth.get(s) ?? 0));
    depth.set(id, d);
    maxDepth = Math.max(maxDepth, d);
  }
  const outDepth = maxDepth + 1;
  for (const id of g.outputs) depth.set(id, outDepth);

  const y = new Map<number, number>();
  const inputs = [...g.inputs, g.biasId];
  inputs.forEach((id, i) => y.set(id, (i + 0.5) / inputs.length));
  const columns = new Map<number, number[]>();
  for (const id of order) {
    if (outputs.has(id)) continue;
    const d = depth.get(id) ?? 1;
    columns.set(d, [...(columns.get(d) ?? []), id]);
  }
  for (let d = 1; d <= maxDepth; d++) {
    const col = columns.get(d) ?? [];
    const bary = (id: number) => {
      const src = incoming.get(id) ?? [];
      const known = src.map((s) => y.get(s)).filter((v): v is number => v !== undefined);
      return known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0.5;
    };
    col.sort((a, b) => bary(a) - bary(b));
    col.forEach((id, i) => y.set(id, (i + 0.5) / col.length));
  }
  g.outputs.forEach((id, i) => y.set(id, (i + 0.5) / g.outputs.length));

  const kindOf = new Map(g.nodes.map((n) => [n.id, n.kind]));
  return g.nodes.map((n) => ({
    id: n.id,
    kind: kindOf.get(n.id) ?? 'hidden',
    x: (depth.get(n.id) ?? 1) / outDepth,
    y: y.get(n.id) ?? 0.5,
    slot: n.kind === 'input' ? g.inputs.indexOf(n.id) : n.kind === 'output' ? g.outputs.indexOf(n.id) : -1,
  }));
}
