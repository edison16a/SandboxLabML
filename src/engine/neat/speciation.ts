import type { Rng } from '../core/rng';
import type { NeatConfig } from './config';
import type { Genome } from './types';

export interface Species {
  id: number;
  representative: Genome;
  members: Genome[];
  bestFitness: number;
  /** Generations since bestFitness last improved. */
  staleness: number;
  createdAt: number;
}

/**
 * Compatibility distance from the NEAT paper: excess and disjoint gene counts
 * plus the mean weight difference of matching genes. Small genomes are not
 * normalized by size, which keeps early speciation from collapsing.
 */
export function compatibility(a: Genome, b: Genome, c: NeatConfig['compatibility']): number {
  const ac = a.connections;
  const bc = b.connections;
  let i = 0;
  let j = 0;
  let matching = 0;
  let weightDiff = 0;
  let disjoint = 0;
  while (i < ac.length && j < bc.length) {
    const ai = ac[i].innovation;
    const bj = bc[j].innovation;
    if (ai === bj) {
      matching++;
      weightDiff += Math.abs(ac[i].weight - bc[j].weight);
      i++;
      j++;
    } else if (ai < bj) {
      disjoint++;
      i++;
    } else {
      disjoint++;
      j++;
    }
  }
  const excess = ac.length - i + (bc.length - j);
  const n = Math.max(ac.length, bc.length);
  const norm = n < 20 ? 1 : n;
  const meanWeight = matching ? weightDiff / matching : 0;
  return (c.excess * excess) / norm + (c.disjoint * disjoint) / norm + c.weight * meanWeight;
}

/**
 * Sorts genomes into species. Each genome joins the first species whose
 * representative is within the threshold. Afterwards the threshold moves one
 * step toward the target species count, so the number of niches stays stable
 * without hand tuning.
 */
export function speciate(
  genomes: Genome[],
  species: Species[],
  threshold: number,
  targetSpecies: number,
  config: NeatConfig,
  rng: Rng,
  nextId: () => number,
  generation: number,
): { species: Species[]; threshold: number } {
  for (const s of species) s.members = [];
  for (const g of genomes) {
    let home = species.find((s) => compatibility(g, s.representative, config.compatibility) < threshold);
    if (!home) {
      home = { id: nextId(), representative: g, members: [], bestFitness: -Infinity, staleness: 0, createdAt: generation };
      species.push(home);
    }
    home.members.push(g);
    g.speciesId = home.id;
  }
  const alive = species.filter((s) => s.members.length > 0);
  for (const s of alive) s.representative = rng.pick(s.members);

  const { step, min } = config.compatibility;
  let next = threshold;
  if (alive.length < targetSpecies) next = Math.max(min, threshold - step);
  else if (alive.length > targetSpecies) next = threshold + step;
  return { species: alive, threshold: next };
}

/** Updates each species' best fitness and how long it has gone without improving. */
export function updateStagnation(species: Species[]): void {
  for (const s of species) {
    const best = Math.max(...s.members.map((m) => m.fitness));
    if (best > s.bestFitness) {
      s.bestFitness = best;
      s.staleness = 0;
    } else {
      s.staleness++;
    }
  }
}

/** Drops species that stopped improving, but always keeps the top two. */
export function cullStagnant(species: Species[], limit: number): Species[] {
  const ranked = [...species].sort((a, b) => b.bestFitness - a.bestFitness);
  const protectedIds = new Set(ranked.slice(0, 2).map((s) => s.id));
  return species.filter((s) => protectedIds.has(s.id) || s.staleness <= limit);
}
