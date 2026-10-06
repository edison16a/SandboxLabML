/**
 * Tunables for NEAT. Defaults follow Stanley and Miikkulainen (2002) with a
 * few modern adjustments: a dynamic compatibility threshold that steers toward
 * a target species count, and weight clamping so networks cannot blow up.
 */
export interface MutationRates {
  /** Chance that a genome's weights get perturbed at all. */
  weights: number;
  /** Per-connection chance of replacing a weight instead of nudging it. */
  replaceWeight: number;
  /** Standard deviation of a weight nudge. */
  weightPower: number;
  addConnection: number;
  addNode: number;
  /** Chance of flipping one connection's enabled flag. */
  toggle: number;
}

export interface NeatConfig {
  populationSize: number;
  mutation: MutationRates;
  crossoverRate: number;
  interspeciesRate: number;
  /** Fraction of each species allowed to parent the next generation. */
  survivalThreshold: number;
  targetSpecies: number;
  compatibility: { excess: number; disjoint: number; weight: number; threshold: number; step: number; min: number };
  /** Generations without improvement before a species is culled. */
  stagnationLimit: number;
  /** Species champions are copied unchanged if the species has at least this many members. */
  eliteMinSpeciesSize: number;
  weightRange: number;
}

export const DEFAULT_MUTATION: MutationRates = {
  weights: 0.8,
  replaceWeight: 0.1,
  weightPower: 0.5,
  addConnection: 0.05,
  addNode: 0.03,
  toggle: 0.01,
};

export const DEFAULT_NEAT: NeatConfig = {
  populationSize: 100,
  mutation: DEFAULT_MUTATION,
  crossoverRate: 0.75,
  interspeciesRate: 0.001,
  survivalThreshold: 0.2,
  targetSpecies: 8,
  compatibility: { excess: 1, disjoint: 1, weight: 0.4, threshold: 3, step: 0.3, min: 0.3 },
  stagnationLimit: 15,
  eliteMinSpeciesSize: 5,
  weightRange: 8,
};

export function neatConfig(overrides: Partial<NeatConfig> = {}): NeatConfig {
  return {
    ...DEFAULT_NEAT,
    ...overrides,
    mutation: { ...DEFAULT_MUTATION, ...overrides.mutation },
    compatibility: { ...DEFAULT_NEAT.compatibility, ...overrides.compatibility },
  };
}
