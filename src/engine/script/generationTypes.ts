import type { HideSeekDirective } from '../hideseek/trainer/types';
import type { GenerationPlan } from '../neat/plan';

/**
 * What the `each generation` block can read. The trainer fills it from the
 * generation that just finished. Same shape as the training layer's
 * GenerationContext, so either can be passed where the other is expected.
 */
export interface GenerationContext {
  generation: number;
  speciesCount: number;
  bestFitness: number;
  meanFitness: number;
  /** Generations since the best fitness of the run last improved. */
  stagnation: number;
  /** The env's generation metrics, such as the level or the share that arrived. */
  metrics?: Readonly<Record<string, number>>;
}

export type TrackDirective = { kind: 'builtin'; id: string } | { kind: 'random'; seed: number };

/** What a generation block decided: the NEAT plan plus requests for each environment. */
export interface GenerationDirectives {
  plan: GenerationPlan;
  racing?: { track?: TrackDirective };
  /** Match rules from the Hide and Seek operators, such as prepTime and opponents. */
  hideseek?: HideSeekDirective;
  /** Requests for the script's own env, written by its registry operators and read by its env module. */
  env?: Record<string, unknown>;
}

/**
 * The view generation-scope bindings receive. Operators only write into the
 * plan and directives here. The NEAT code reads the plan afterwards and does
 * the real work, so a script can steer evolution but never break it.
 */
export interface GenerationView {
  ctx: GenerationContext;
  directives: GenerationDirectives;
}
