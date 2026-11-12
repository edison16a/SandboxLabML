import type { Rng } from '../core/rng';
import type { AgentController, CustomSensorSpec } from '../env/types';
import { defaultPlan } from '../neat/population';
import type { NeatConfig } from '../neat/config';
import type { GenerationPlan } from '../neat/plan';
import type { Track } from '../racing/track/types';

/** Facts about the finished generation that a script's `each generation` block can read. */
export interface GenerationContext {
  generation: number;
  speciesCount: number;
  bestFitness: number;
  meanFitness: number;
  /** Generations since the best fitness of the run last improved. */
  stagnation: number;
  /** The env's generation metrics (see EpisodeEnvModule.generationMetrics), so a block can read a level or an arrival share. */
  metrics?: Readonly<Record<string, number>>;
}

export type TrackDirective = { kind: 'builtin'; id: string } | { kind: 'random'; seed: number };

/** What the generation block decided: the NEAT plan plus environment changes. */
export interface GenerationDirectives {
  plan: GenerationPlan;
  racing?: { track?: TrackDirective };
  /**
   * Requests for the script's own env, such as a level or a course. A
   * script belongs to one env, so one slot is enough: that env's registry
   * operators each set their own key in it with setEnvDirective, and its
   * module's nextContent reads them.
   */
  env?: Record<string, unknown>;
}

/** What a compiled script's controller is bound to for one episode batch. Matches the script registry's ControllerContext. */
export interface ControllerRequest {
  seed: number;
  /** Racing scripts that read the road need it. */
  track?: Track;
  /** Whatever else an env's script entries read, such as a city. */
  extra?: Readonly<Record<string, unknown>>;
}

/**
 * The training layer talks to rewards and generation logic only through this
 * interface. The built-in reward implements it directly, and compiled scripts
 * are wrapped to implement it, so trainers never care which one they run.
 */
export interface ScriptHost {
  readonly customSensors: CustomSensorSpec[];
  /**
   * The script's per tick controller for one episode. Null means the run
   * has no script, and the env module uses its own built in reward.
   */
  createController<V>(ctx: ControllerRequest): AgentController<V> | null;
  runGeneration(ctx: GenerationContext, rng: Rng, neat: NeatConfig): GenerationDirectives;
}

export const builtinHost: ScriptHost = {
  customSensors: [],
  createController: () => null,
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
