import type { Rng } from '../core/rng';
import type { AgentController } from '../env/types';
import { defaultPlan } from '../neat/population';
import type { NeatConfig } from '../neat/config';
import type { GenerationPlan } from '../neat/plan';
import { builtinRacingController } from '../racing/builtinReward';
import type { RacingCar } from '../racing/car/runtime';
import type { CustomSensorSpec } from '../racing/sensors/inputSchema';
import type { Track } from '../racing/track/types';

/** Facts about the finished generation that a script's `each generation` block can read. */
export interface GenerationContext {
  generation: number;
  speciesCount: number;
  bestFitness: number;
  meanFitness: number;
  /** Generations since the best fitness of the run last improved. */
  stagnation: number;
}

export type TrackDirective = { kind: 'builtin'; id: string } | { kind: 'random'; seed: number };

/** What the generation block decided: the NEAT plan plus environment changes. */
export interface GenerationDirectives {
  plan: GenerationPlan;
  racing?: { track?: TrackDirective };
  hideseek?: Record<string, unknown>;
}

/**
 * The training layer talks to rewards and generation logic only through this
 * interface. The built-in reward implements it directly, and compiled scripts
 * are wrapped to implement it, so trainers never care which one they run.
 */
export interface ScriptHost {
  readonly customSensors: CustomSensorSpec[];
  createRacingController(seed: number, track: Track): AgentController<RacingCar>;
  runGeneration(ctx: GenerationContext, rng: Rng, neat: NeatConfig): GenerationDirectives;
}

export const builtinHost: ScriptHost = {
  customSensors: [],
  createRacingController: () => builtinRacingController,
  runGeneration: (_ctx, _rng, neat) => ({ plan: defaultPlan(neat) }),
};

type HostFactory = (source: string) => ScriptHost;
let scriptHostFactory: HostFactory | null = null;

/**
 * The script compiler registers itself here. This keeps the training core
 * free of a hard dependency on the language package, which is large and only
 * needed when a run actually has a script.
 */
export function registerScriptHostFactory(factory: HostFactory): void {
  scriptHostFactory = factory;
}

export function hostFor(source: string | null): ScriptHost {
  if (!source) return builtinHost;
  if (!scriptHostFactory) throw new Error('Scripts are not available: the script compiler was not loaded.');
  return scriptHostFactory(source);
}
