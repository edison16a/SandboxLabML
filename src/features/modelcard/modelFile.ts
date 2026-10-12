import { engineVersionOf } from '@/engine/core/version';
import { topologicalOrder } from '@/engine/neat/network';
import { bytesToBase64, encodeGenome } from '@/engine/neat/serialize';
import type { Activation, Genome, NodeKind } from '@/engine/neat/types';
import type { RunConfig } from '@/engine/training/runConfig';

export const MODEL_FORMAT = 'sandboxlab-model';

/**
 * A trained brain as a file anyone can read. The neurons and links are
 * spelled out with their labels, so the network can be studied or run in
 * other code without this app; `genome` keeps the exact binary copy the
 * app itself stores, so nothing is lost to rounding.
 */
export interface ModelFile {
  format: typeof MODEL_FORMAT;
  version: 1;
  exportedAt: string;
  env: RunConfig['env'];
  /** Which side the brain plays in Hide and Seek. */
  team?: 'hider' | 'seeker';
  run: { id: string; name: string };
  generation: number;
  fitness: number;
  engineVersion: number;
  /** Hidden neurons use this; outputs always use tanh, so every action sits in -1 to 1. */
  activation: Activation;
  inputs: string[];
  outputs: string[];
  neurons: Array<{ id: number; kind: NodeKind; label?: string }>;
  links: Array<{ from: number; to: number; weight: number; enabled: boolean }>;
  /** Hidden and output neuron ids in an order where every neuron comes after all of its sources. */
  order: number[];
  genome: string;
}

export interface ModelSource {
  run: RunConfig;
  genome: Genome;
  generation: number;
  fitness: number;
  inputLabels: readonly string[];
  outputLabels: readonly string[];
  team?: 'hider' | 'seeker';
}

/** Builds the downloadable file for one champion brain. */
export function modelFile(s: ModelSource): ModelFile {
  const g = s.genome;
  const labels = new Map<number, string>();
  g.inputs.forEach((id, i) => labels.set(id, s.inputLabels[i] ?? `input ${i + 1}`));
  g.outputs.forEach((id, i) => labels.set(id, s.outputLabels[i] ?? `output ${i + 1}`));
  labels.set(g.biasId, 'bias');
  return {
    format: MODEL_FORMAT,
    version: 1,
    exportedAt: new Date().toISOString(),
    env: s.run.env,
    ...(s.team ? { team: s.team } : {}),
    run: { id: s.run.id, name: s.run.name },
    generation: s.generation,
    fitness: s.fitness,
    engineVersion: engineVersionOf(s.run.env),
    activation: g.activation,
    inputs: g.inputs.map((id) => labels.get(id) ?? ''),
    outputs: g.outputs.map((id) => labels.get(id) ?? ''),
    neurons: g.nodes.map((n) => (labels.has(n.id) ? { id: n.id, kind: n.kind, label: labels.get(n.id) } : { id: n.id, kind: n.kind })),
    links: g.connections.map((c) => ({ from: c.from, to: c.to, weight: c.weight, enabled: c.enabled })),
    order: topologicalOrder(g),
    genome: bytesToBase64(encodeGenome(g)),
  };
}

/** A file name such as oval-laps-gen-42-hider.model.json. */
export function modelFileName(runName: string, generation: number, team?: string): string {
  const slug = runName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'model';
  return `${slug}-gen-${generation + 1}${team ? `-${team}` : ''}.model.json`;
}
