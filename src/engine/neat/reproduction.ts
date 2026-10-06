import type { Rng } from '../core/rng';
import type { NeatConfig, MutationRates } from './config';
import { crossover } from './crossover';
import { cloneGenome } from './genome';
import type { InnovationTracker } from './innovation';
import { mutate } from './mutation';
import type { Species } from './speciation';
import type { Genome } from './types';

/**
 * Splits the next population between species in proportion to their summed
 * shared fitness (fitness divided by species size), using largest remainders
 * so the counts add up exactly.
 */
export function allocateOffspring(species: Species[], total: number): number[] {
  if (!species.length) return [];
  let min = Infinity;
  for (const s of species) for (const m of s.members) min = Math.min(min, m.fitness);
  const shares = species.map((s) => {
    let sum = 0;
    for (const m of s.members) sum += m.fitness - min + 1e-3;
    return sum / s.members.length;
  });
  const sumShares = shares.reduce((a, b) => a + b, 0);
  const exact = shares.map((x) => (x / sumShares) * total);
  const counts = exact.map(Math.floor);
  let left = total - counts.reduce((a, b) => a + b, 0);
  const order = exact.map((x, i) => [x - Math.floor(x), i] as const).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (let k = 0; left > 0; k = (k + 1) % order.length, left--) counts[order[k][1]]++;
  return counts;
}

export interface BreedContext {
  rng: Rng;
  tracker: InnovationTracker;
  config: NeatConfig;
  rates: MutationRates;
  crossoverRate: number;
  survival: number;
  keepChampions: boolean;
  generation: number;
  nextId: () => number;
  /** Parent pools of every species, for the rare interspecies mating. */
  allParents: Genome[];
}

/** Top fraction of a species by fitness, at least one member. */
export function parentPool(s: Species, survival: number): Genome[] {
  const sorted = [...s.members].sort((a, b) => b.fitness - a.fitness || a.id - b.id);
  return sorted.slice(0, Math.max(1, Math.ceil(sorted.length * survival)));
}

/** Fills `count` slots for one species: its champion first if elitism applies, then children. */
export function breedSpecies(s: Species, count: number, ctx: BreedContext): Genome[] {
  const out: Genome[] = [];
  if (count <= 0) return out;
  const parents = parentPool(s, ctx.survival);
  if (ctx.keepChampions && s.members.length >= ctx.config.eliteMinSpeciesSize) {
    out.push(cloneGenome(parents[0]));
  }
  while (out.length < count) {
    const mom = ctx.rng.pick(parents);
    let child: Genome;
    if (parents.length > 1 && ctx.rng.chance(ctx.crossoverRate)) {
      const pool = ctx.rng.chance(ctx.config.interspeciesRate) ? ctx.allParents : parents;
      let dad = ctx.rng.pick(pool);
      if (dad === mom && parents.length > 1) dad = ctx.rng.pick(parents);
      child = crossover(mom, dad, ctx.rng, ctx.nextId(), ctx.generation);
    } else {
      child = cloneGenome(mom, ctx.nextId());
      child.birthGeneration = ctx.generation;
    }
    mutate(child, ctx.rates, ctx.tracker, ctx.rng, ctx.config.weightRange);
    child.fitness = 0;
    out.push(child);
  }
  return out;
}
