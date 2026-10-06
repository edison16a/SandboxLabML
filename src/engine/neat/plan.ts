import type { MutationRates } from './config';

/**
 * What a script's `each generation` block asks for. Script operators only
 * fill in this plan; the tested NEAT code does the actual work, so a script
 * can shape evolution but never break it.
 */
export interface GenerationPlan {
  targetSpecies: number;
  /** Fraction of each species that may become a parent. */
  survival: number;
  crossoverRate: number;
  mutation: MutationRates;
  keepChampions: boolean;
  /** Scale structural mutation up when there are too few species and down when there are too many. */
  adaptive: boolean;
  stagnationLimit: number;
}

export function adaptiveRates(plan: GenerationPlan, speciesCount: number): MutationRates {
  if (!plan.adaptive || speciesCount === 0) return plan.mutation;
  const f = Math.min(2, Math.max(0.5, plan.targetSpecies / speciesCount));
  return {
    ...plan.mutation,
    addConnection: Math.min(1, plan.mutation.addConnection * f),
    addNode: Math.min(1, plan.mutation.addNode * f),
    weightPower: plan.mutation.weightPower * Math.sqrt(f),
  };
}
