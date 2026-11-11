/**
 * The contract every single population environment implements. Racing is
 * the first; Driving and Navigation follow. The trainer, the workers, the
 * storage layer and the lab UI only ever talk to an env through this file,
 * so a new env is a set of modules plus one entry in `registry.ts`.
 *
 * The shape: one population of independent agents shares one world. Every
 * agent gets its own brain, agents never touch each other, and an episode
 * runs every brain once. That is what makes a champion replay exactly when
 * it is re-simulated alone.
 */
import type { Blueprint, BlueprintIssue } from '../blueprints/types';
import type { Network } from '../neat/network';
import type { Genome } from '../neat/types';
import type { BenchOptions, BenchResult } from '../bench/types';
import type { GenerationDirectives, ScriptHost } from '../training/scriptHost';
import type { ChampionRecord } from '../training/records';
import type { RunConfig } from '../training/runConfig';
import type { MetricSpec } from './metrics';
import type { CustomSensorSpec, EnvId, InputSpec, OutputSpec, SnapshotLayout } from './types';

/** Per agent outcome of one episode. Envs add their own fields. */
export interface EpisodeResult {
  fitness: number;
  /** Simulated seconds the agent ran, summed into the generation's simulated time. */
  time: number;
  stopReason: string | null;
}

/**
 * Every setup carries the script it runs under, so a worker can compile it
 * and a ghost player can swap it per ghost. The rest is the env's own plain
 * data (a track, a city, a course), posted between threads as is.
 */
export interface EpisodeSetup {
  scriptSource: string | null;
  /** Sandbox lesion test, as (input index, forced value) pairs. Training never sets it. */
  lesion?: Array<[number, number]>;
}

/**
 * A running episode: many agents stepped in lockstep at the env's tick rate.
 * Hot paths (step, writeSnapshot, writeWorld) must allocate nothing.
 */
export interface EpisodeEnv<R extends EpisodeResult = EpisodeResult> {
  readonly agentCount: number;
  /** Ticks since reset. */
  readonly tick: number;
  /** True once every agent has stopped. */
  readonly done: boolean;
  /** Floats of world state written after the agents in every frame (lights, traffic, movers). 0 when none. */
  readonly worldFloats: number;
  /** Rays per agent the inputs overlay can draw. 0 when the env has none. */
  readonly raysPerAgent: number;
  /**
   * Starts a fresh episode with one agent per brain. `seeds` drive per agent
   * noise and script rand(); `slots` are start positions for Sandbox grids
   * (training leaves them out, so every agent starts at slot 0).
   */
  reset(brains: Network[], seeds?: number[], slots?: number[]): void;
  step(): void;
  /** Writes `snapshot.stride` floats per agent, in agent order, from `offset`. */
  writeSnapshot(out: Float32Array, offset?: number): void;
  /** Writes `worldFloats` floats of shared world state from `offset`. Only called when worldFloats > 0. */
  writeWorld?(out: Float32Array, offset: number): void;
  /** The agent the camera should follow: the furthest along among those still running. */
  leaderIndex(): number;
  results(): R[];
  /** Latest observation of agent i, as the brain received it. */
  lastObservation(i: number): Float64Array;
  /** What agent i commanded on its latest tick, in output order, for the inputs panel. */
  writeOutputs(i: number, out: Float32Array): void;
  /** Agent i's rays as fractions of their range, `raysPerAgent` floats from `offset`. */
  writeRays?(i: number, out: Float32Array, offset: number): void;
}

/** What `createSetup` gets: the run, what it trains on now, and the generation. */
export interface SetupInput<Content> {
  config: RunConfig;
  content: Content;
  generation: number;
  scriptSource: string | null;
}

/** What `nextContent` gets once a generation finished and its script block ran. */
export interface ContentStep<Content, R extends EpisodeResult> {
  config: RunConfig;
  content: Content;
  generation: number;
  directives: GenerationDirectives;
  results: readonly R[];
  /** The env's generation metrics for these results (see generationMetrics). */
  metrics: Readonly<Record<string, number>>;
}

/** The env's half of a champion record. Racing returns its distance and lap fields; newer envs return `{ metrics }`. */
export type ChampionFields<C extends ChampionRecord> = Omit<C, 'genomeId' | 'fitness' | 'stopReason'>;

/** The benchmark: held out content and a score from 0 to 100 that ignores the training reward. */
export interface EpisodeBench {
  version: number;
  /** Radar axes in drawing order, clockwise from the top. */
  axes: ReadonlyArray<{ key: string; label: string }>;
  /** Shown beside the benchmark chart, e.g. "unseen tracks, 0 to 100". */
  hint: string;
  run(config: RunConfig, genome: Genome, opts?: BenchOptions): Promise<BenchResult | null>;
}

/**
 * One single population environment. `Content` is what the population
 * trains on right now (Racing: the track; Driving: a city, level and route
 * seed; Navigation: a level and course seed). It is plain data, kept in
 * checkpoints, and changed by the script's generation block or by the
 * env's own curriculum.
 */
export interface EpisodeEnvModule<Setup extends EpisodeSetup = EpisodeSetup, Content = unknown, R extends EpisodeResult = EpisodeResult, C extends ChampionRecord = ChampionRecord> {
  readonly id: EnvId;
  /** Display name, e.g. "Racing". */
  readonly label: string;
  /** Bumped whenever a change could alter this env's results. Runs and references store it. */
  readonly engineVersion: number;
  readonly tickHz: number;
  /** Per agent layout of the population and ghost streams. */
  readonly snapshot: SnapshotLayout;
  readonly outputs: readonly OutputSpec[];
  /** Generation stats the env records, in the order the lab shows them. */
  readonly metrics: readonly MetricSpec[];

  /** The preset brains, simplest first. The first is the default for a new run. */
  readonly blueprints: readonly Blueprint[];
  /** Brain inputs the blueprint's built in sensors produce, before script sensors. */
  inputCount(inputs: unknown): number;
  /** Problems with a blueprint's sensor config, for the blueprint form and imports. */
  validateInputs?(inputs: unknown): BlueprintIssue[];
  /** Every brain input of a run in observation order, script sensors last. */
  inputSchema(config: RunConfig, custom?: readonly CustomSensorSpec[]): InputSpec[];
  /** Hash of the rules a run freezes (physics, sensors), stored as the run's physicsHash. */
  physicsHash(config: RunConfig): string;

  initialContent(config: RunConfig): Content;
  /** The content for the next generation, or null to keep it. `reset` means old scores no longer compare. */
  nextContent(step: ContentStep<Content, R>): { content: Content; reset: boolean } | null;
  /** Stored on every record as `trackHash`, so a path or replay knows what it ran on. */
  contentHash(content: Content): string;
  createSetup(input: SetupInput<Content>): Setup;
  /** Builds an episode. The script controller comes from `host`; null means the env's built in reward. */
  createEnv(setup: Setup, host: ScriptHost, seed: number): EpisodeEnv<R>;

  championFields(result: R): ChampionFields<C>;
  /** Stats over the whole generation, keyed like `metrics` with source 'generation'. */
  generationMetrics?(results: readonly R[], content: Content): Record<string, number>;

  bench?: EpisodeBench;
  telemetry?: GhostTrace<R>;
}

/**
 * Per tick numbers for a ghost's telemetry line (the speed strip and the
 * brake map). Optional: an env without it shows no telemetry.
 */
export interface GhostTrace<R extends EpisodeResult> {
  /** Writes [distance along the course in m, speed in m/s, brake from 0 to 1] for agent i after the latest tick. */
  sample(env: EpisodeEnv<R>, i: number, out: Float64Array): void;
  /** Where the agent's run ended in a crash, in world x and y, or null. */
  crash(result: R): { x: number; y: number } | null;
}

/** Any registered module, with its type parameters erased for generic code. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEpisodeModule = EpisodeEnvModule<any, any, any, any>;
