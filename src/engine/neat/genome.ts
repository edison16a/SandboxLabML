import type { Rng } from '../core/rng';
import type { InnovationTracker } from './innovation';
import type { ConnectionGene, Genome, GenomeShape, NodeGene } from './types';

/**
 * The node layout every genome in a population starts from. Ids are shared,
 * so input 3 means the same sensor in every genome of the run.
 */
export interface GenomeTemplate {
  shape: GenomeShape;
  inputs: number[];
  outputs: number[];
  biasId: number;
  hidden: number[];
}

export function createTemplate(shape: GenomeShape, tracker: InnovationTracker): GenomeTemplate {
  const inputs = Array.from({ length: shape.inputCount }, () => tracker.newNodeId());
  const biasId = tracker.newNodeId();
  const outputs = Array.from({ length: shape.outputCount }, () => tracker.newNodeId());
  const hiddenCount = shape.wiring === 'hidden' ? Math.max(1, shape.hiddenCount ?? 4) : 0;
  const hidden = Array.from({ length: hiddenCount }, () => tracker.newNodeId());
  return { shape, inputs, outputs, biasId, hidden };
}

function randomWeight(rng: Rng): number {
  return Math.fround(rng.range(-1, 1) * 2);
}

/** A fresh genome with random weights on the template's starting wiring. */
export function createGenome(
  template: GenomeTemplate,
  tracker: InnovationTracker,
  rng: Rng,
  id: number,
  generation = 0,
): Genome {
  const { shape, inputs, outputs, biasId, hidden } = template;
  const nodes: NodeGene[] = [
    ...inputs.map((nid) => ({ id: nid, kind: 'input' as const })),
    { id: biasId, kind: 'bias' as const },
    ...outputs.map((nid) => ({ id: nid, kind: 'output' as const })),
    ...hidden.map((nid) => ({ id: nid, kind: 'hidden' as const })),
  ];
  const connections: ConnectionGene[] = [];
  const connect = (from: number, to: number) =>
    connections.push({ innovation: tracker.connection(from, to), from, to, weight: randomWeight(rng), enabled: true });

  const sources = [...inputs, biasId];
  if (shape.wiring === 'hidden') {
    for (const h of hidden) for (const s of sources) connect(s, h);
    for (const o of outputs) {
      for (const h of hidden) connect(h, o);
      connect(biasId, o);
    }
  } else {
    for (const o of outputs) {
      for (const s of sources) {
        // Sparse wiring keeps half the input links but always wires the bias.
        if (shape.wiring === 'sparse' && s !== biasId && !rng.chance(0.5)) continue;
        connect(s, o);
      }
    }
  }
  connections.sort((a, b) => a.innovation - b.innovation);
  return {
    id,
    inputs: [...inputs],
    outputs: [...outputs],
    biasId,
    nodes,
    connections,
    activation: shape.activation,
    fitness: 0,
    birthGeneration: generation,
    speciesId: -1,
  };
}

export function cloneGenome(g: Genome, id = g.id): Genome {
  return {
    ...g,
    id,
    inputs: [...g.inputs],
    outputs: [...g.outputs],
    nodes: g.nodes.map((n) => ({ ...n })),
    connections: g.connections.map((c) => ({ ...c })),
  };
}

export function hasNode(g: Genome, id: number): boolean {
  return g.nodes.some((n) => n.id === id);
}

/** Inserts a connection keeping the list sorted by innovation. */
export function insertConnection(g: Genome, c: ConnectionGene): void {
  let i = g.connections.length;
  while (i > 0 && g.connections[i - 1].innovation > c.innovation) i--;
  g.connections.splice(i, 0, c);
}

export interface GenomeCounts {
  inputs: number;
  outputs: number;
  hidden: number;
  enabled: number;
  disabled: number;
}

export function countGenome(g: Genome): GenomeCounts {
  let enabled = 0;
  for (const c of g.connections) if (c.enabled) enabled++;
  return {
    inputs: g.inputs.length,
    outputs: g.outputs.length,
    hidden: g.nodes.filter((n) => n.kind === 'hidden').length,
    enabled,
    disabled: g.connections.length - enabled,
  };
}
