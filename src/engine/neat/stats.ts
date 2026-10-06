import { countGenome } from './genome';
import type { Species } from './speciation';
import type { Genome } from './types';

export interface SpeciesStat {
  id: number;
  size: number;
  best: number;
  staleness: number;
}

/** One row of the fitness and species charts, recorded for every generation. */
export interface GenerationStats {
  generation: number;
  best: number;
  mean: number;
  median: number;
  worst: number;
  championId: number;
  species: SpeciesStat[];
  /** Mean hidden nodes and enabled connections, to chart network growth. */
  meanHidden: number;
  meanConnections: number;
  threshold: number;
}

export function computeStats(generation: number, genomes: Genome[], species: Species[], threshold: number): GenerationStats {
  const fits = genomes.map((g) => g.fitness).sort((a, b) => a - b);
  const n = fits.length;
  const champion = genomes.reduce((best, g) => (g.fitness > best.fitness ? g : best), genomes[0]);
  let hidden = 0;
  let conns = 0;
  for (const g of genomes) {
    const c = countGenome(g);
    hidden += c.hidden;
    conns += c.enabled;
  }
  return {
    generation,
    best: fits[n - 1],
    worst: fits[0],
    mean: fits.reduce((a, b) => a + b, 0) / n,
    median: n % 2 ? fits[(n - 1) / 2] : (fits[n / 2 - 1] + fits[n / 2]) / 2,
    championId: champion.id,
    species: species.map((s) => ({ id: s.id, size: s.members.length, best: s.bestFitness, staleness: s.staleness })),
    meanHidden: hidden / n,
    meanConnections: conns / n,
    threshold,
  };
}
