import { Rng, type RngState } from '../core/rng';
import { neatConfig, type NeatConfig } from './config';
import { cloneGenome, createGenome, createTemplate, type GenomeTemplate } from './genome';
import { InnovationTracker, type InnovationState } from './innovation';
import { adaptiveRates, type GenerationPlan } from './plan';
import { allocateOffspring, breedSpecies, parentPool, type BreedContext } from './reproduction';
import { cullStagnant, speciate, updateStagnation, type Species } from './speciation';
import { computeStats, type GenerationStats } from './stats';
import type { Genome, GenomeShape } from './types';

/** Everything needed to resume evolution exactly where it stopped. */
export interface PopulationState {
  generation: number;
  genomes: Genome[];
  species: Array<Omit<Species, 'members' | 'representative'> & { representative: Genome }>;
  threshold: number;
  nextGenomeId: number;
  nextSpeciesId: number;
  rng: RngState;
  tracker: InnovationState;
  template: GenomeTemplate;
  config: NeatConfig;
}

export function defaultPlan(config: NeatConfig): GenerationPlan {
  return {
    targetSpecies: config.targetSpecies,
    survival: config.survivalThreshold,
    crossoverRate: config.crossoverRate,
    mutation: config.mutation,
    keepChampions: true,
    adaptive: false,
    stagnationLimit: config.stagnationLimit,
  };
}

/**
 * A NEAT population. The caller evaluates `genomes` (sets fitness), then
 * calls `advance` with a plan to produce the next generation.
 */
export class Population {
  generation = 0;
  genomes: Genome[] = [];
  species: Species[] = [];
  threshold: number;
  readonly config: NeatConfig;
  readonly tracker: InnovationTracker;
  readonly rng: Rng;
  readonly template: GenomeTemplate;
  private nextGenomeId = 0;
  private nextSpeciesId = 0;

  private constructor(config: NeatConfig, tracker: InnovationTracker, rng: Rng, template: GenomeTemplate) {
    this.config = config;
    this.tracker = tracker;
    this.rng = rng;
    this.template = template;
    this.threshold = config.compatibility.threshold;
  }

  static create(shape: GenomeShape, seed: number, overrides: Partial<NeatConfig> = {}): Population {
    const config = neatConfig(overrides);
    const tracker = new InnovationTracker();
    const template = createTemplate(shape, tracker);
    const pop = new Population(config, tracker, new Rng(seed), template);
    for (let i = 0; i < config.populationSize; i++) {
      pop.genomes.push(createGenome(template, tracker, pop.rng, pop.nextGenomeId++, 0));
    }
    return pop;
  }

  /** Builds a population from existing genomes, used when forking a run with new inputs. */
  static fromGenomes(genomes: Genome[], template: GenomeTemplate, tracker: InnovationTracker, seed: number, overrides: Partial<NeatConfig> = {}): Population {
    const pop = new Population(neatConfig(overrides), tracker, new Rng(seed), template);
    pop.genomes = genomes.map((g) => cloneGenome(g));
    pop.nextGenomeId = Math.max(0, ...genomes.map((g) => g.id)) + 1;
    return pop;
  }

  static fromState(s: PopulationState): Population {
    const pop = new Population(s.config, InnovationTracker.fromState(s.tracker), Rng.fromState(s.rng), s.template);
    pop.generation = s.generation;
    pop.genomes = s.genomes.map((g) => cloneGenome(g));
    pop.threshold = s.threshold;
    pop.nextGenomeId = s.nextGenomeId;
    pop.nextSpeciesId = s.nextSpeciesId;
    pop.species = s.species.map((sp) => ({ ...sp, representative: cloneGenome(sp.representative), members: [] }));
    return pop;
  }

  toState(): PopulationState {
    return {
      generation: this.generation,
      genomes: this.genomes.map((g) => cloneGenome(g)),
      species: this.species.map(({ members: _m, ...rest }) => ({ ...rest, representative: cloneGenome(rest.representative) })),
      threshold: this.threshold,
      nextGenomeId: this.nextGenomeId,
      nextSpeciesId: this.nextSpeciesId,
      rng: this.rng.getState(),
      tracker: this.tracker.toState(),
      template: this.template,
      config: this.config,
    };
  }

  /**
   * Forgets every species' best score. Call it when the environment changes
   * (a new track): old bests were earned on easier or different ground, and
   * keeping them would mark every species as stagnant and cull them.
   */
  resetStagnation(): void {
    for (const s of this.species) {
      s.bestFitness = -Infinity;
      s.staleness = 0;
    }
  }

  champion(): Genome {
    return this.genomes.reduce((best, g) => (g.fitness > best.fitness ? g : best), this.genomes[0]);
  }

  /**
   * Speciates the evaluated generation, records its stats, then breeds the
   * next one. Returns the stats of the generation that was just evaluated.
   */
  advance(plan: GenerationPlan = defaultPlan(this.config)): GenerationStats {
    const sorted = speciate(this.genomes, this.species, this.threshold, plan.targetSpecies, this.config, this.rng, () => this.nextSpeciesId++, this.generation);
    this.species = sorted.species;
    this.threshold = sorted.threshold;
    updateStagnation(this.species);
    const stats = computeStats(this.generation, this.genomes, this.species, this.threshold);
    const champion = cloneGenome(this.champion());

    const breeding = cullStagnant(this.species, plan.stagnationLimit);
    const counts = allocateOffspring(breeding, this.config.populationSize);
    const nextGeneration = this.generation + 1;
    const ctx: BreedContext = {
      rng: this.rng,
      tracker: this.tracker,
      config: this.config,
      rates: adaptiveRates(plan, this.species.length),
      crossoverRate: plan.crossoverRate,
      survival: plan.survival,
      keepChampions: plan.keepChampions,
      generation: nextGeneration,
      nextId: () => this.nextGenomeId++,
      allParents: breeding.flatMap((s) => parentPool(s, plan.survival)),
    };
    const next: Genome[] = [];
    breeding.forEach((s, i) => next.push(...breedSpecies(s, counts[i], ctx)));

    // The best genome of the run so far always survives when elitism is on.
    if (plan.keepChampions && !next.some((g) => g.id === champion.id)) next[next.length - 1] = champion;
    for (const g of next) g.fitness = 0;
    this.genomes = next;
    this.generation = nextGeneration;
    return stats;
  }
}
