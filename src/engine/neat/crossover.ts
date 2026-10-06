import type { Rng } from '../core/rng';
import type { ConnectionGene, Genome } from './types';

/**
 * NEAT crossover. Matching genes (same innovation) are inherited from either
 * parent at random; disjoint and excess genes always come from the fitter
 * parent. Taking structure from one parent keeps the child acyclic, because
 * both parents are. A gene disabled in either parent stays disabled 75% of
 * the time, as in the original paper.
 */
export function crossover(a: Genome, b: Genome, rng: Rng, childId: number, generation: number): Genome {
  const aFitter = a.fitness > b.fitness || (a.fitness === b.fitness && rng.chance(0.5));
  const fit = aFitter ? a : b;
  const other = aFitter ? b : a;
  const otherByInnovation = new Map<number, ConnectionGene>();
  for (const c of other.connections) otherByInnovation.set(c.innovation, c);

  const connections: ConnectionGene[] = fit.connections.map((c) => {
    const match = otherByInnovation.get(c.innovation);
    const source = match && rng.chance(0.5) ? match : c;
    let enabled = source.enabled;
    if (match && (!c.enabled || !match.enabled)) enabled = !rng.chance(0.75);
    return { innovation: c.innovation, from: c.from, to: c.to, weight: source.weight, enabled };
  });

  return {
    id: childId,
    inputs: [...fit.inputs],
    outputs: [...fit.outputs],
    biasId: fit.biasId,
    nodes: fit.nodes.map((n) => ({ ...n })),
    connections,
    activation: fit.activation,
    fitness: 0,
    birthGeneration: generation,
    speciesId: -1,
  };
}
