import { Rng } from '../core/rng';
import { cloneGenome, insertConnection } from '../neat/genome';
import { InnovationTracker } from '../neat/innovation';
import { mutateWeights } from '../neat/mutation';
import { DEFAULT_MUTATION } from '../neat/config';
import type { Genome } from '../neat/types';

/**
 * Rebuilds an innovation tracker that is consistent with existing genomes:
 * known links keep their numbers and new ids start above everything in use.
 * Used when a run starts from genomes rather than from scratch.
 */
export function trackerFromGenomes(genomes: Genome[]): InnovationTracker {
  let maxNode = 0;
  let maxInnovation = 0;
  for (const g of genomes) {
    for (const n of g.nodes) maxNode = Math.max(maxNode, n.id);
    for (const c of g.connections) maxInnovation = Math.max(maxInnovation, c.innovation);
  }
  const tracker = InnovationTracker.fromState({ nextNodeId: maxNode + 1, nextInnovation: maxInnovation + 1, connections: [], splits: [] });
  for (const g of genomes) for (const c of g.connections) tracker.registerConnection(c.from, c.to, c.innovation);
  return tracker;
}

/**
 * Seeds a population from one champion: one exact copy plus mutated copies,
 * so a branch starts from what that generation knew and spreads out again.
 */
export function populationFromChampion(champion: Genome, size: number, seed: number): Genome[] {
  const rng = new Rng(seed);
  return Array.from({ length: size }, (_, i) => {
    const g = cloneGenome(champion, i);
    g.fitness = 0;
    g.birthGeneration = 0;
    g.speciesId = -1;
    if (i > 0) mutateWeights(g, { ...DEFAULT_MUTATION, replaceWeight: 0.05 }, rng, 8);
    return g;
  });
}

/**
 * Re-maps a genome onto a new input list. Inputs whose key survives keep
 * their node and links; new inputs get fresh, unconnected nodes; removed
 * inputs are deleted with their links. Because new nodes have no links, the
 * forked brain behaves exactly as before until evolution wires them in.
 */
export function forkGenome(g: Genome, oldKeys: string[], newKeys: string[], tracker: InnovationTracker): Genome {
  const out = cloneGenome(g);
  const byKey = new Map(oldKeys.map((k, i) => [k, g.inputs[i]]));
  const kept = new Set<number>();
  out.inputs = newKeys.map((k) => {
    const id = byKey.get(k);
    if (id !== undefined) {
      kept.add(id);
      return id;
    }
    const fresh = tracker.newNodeId();
    out.nodes.push({ id: fresh, kind: 'input' });
    kept.add(fresh);
    return fresh;
  });
  const removed = new Set(g.inputs.filter((id) => !kept.has(id)));
  out.nodes = out.nodes.filter((n) => !removed.has(n.id));
  const conns = out.connections.filter((c) => !removed.has(c.from));
  out.connections = [];
  for (const c of conns) insertConnection(out, c);
  return out;
}
