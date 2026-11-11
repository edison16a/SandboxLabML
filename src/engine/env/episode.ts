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
 *
 * An env comes in two halves. Its info (EpisodeEnvInfo) is light: names,
 * layouts, metrics, brains and the input schema, which any page may read.
 * Its module (EpisodeEnvModule) adds the simulation, which only workers,
 * labs and headless code load, through the info's `load`.
 */
import type { Blueprint, BlueprintIssue } from '../blueprints/types';
import type { Network } from '../neat/network';
import type { GenerationDirectives, ScriptHost } from '../training/scriptHost';
import type { ChampionRecord } from '../training/records';
import type { RunConfig } from '../training/runConfig';
import type { EpisodeBench, EpisodeLessons, EpisodeLessonsInfo, GhostTrace } from './hooks';
import type { MetricSpec } from './metrics';
import type { CustomSensorSpec, EnvId, InputSpec, OutputSpec, SnapshotLayout } from './types';

export type { EpisodeBench, EpisodeLessons, EpisodeLessonsInfo, GhostTrace } from './hooks';

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
  /**
   * Writes `worldFloats` floats of shared world state from `offset`. Only
   * called when worldFloats > 0. The world must follow only the setup and
   * the tick, never the agents, since ghosts of several script versions
   * share the world of whichever env is furthest along.
   */
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
  /**
   * Plain data about what this episode runs on (Navigation: the course on
   * screen), sent once with the stream's start message so the viewport
   * draws exactly the scene the agents are in. Left out, nothing is sent.
   */
  scene?(): unknown;
}

/**
 * What `createSetup` gets: the run and what it trains on now. There is no
 * generation on purpose. Anything that changes from one generation to the
 * next (a level, a route seed) belongs in the content, which nextContent
 * moves on, checkpoints keep and records can store. Ghosts and the
 * Sandbox replay on the live content, so a setup built from the content
 * alone means the same episode wherever it is rebuilt.
 */
export interface SetupInput<Content> {
  config: RunConfig;
  content: Content;
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

/**
 * The light half of an env: what the main thread needs to label, list,
 * chart and configure runs without the simulation. Keep its imports to
 * layouts, schemas and blueprints, since every page that touches the
 * registry ships it.
 */
export interface EpisodeEnvInfo {
  readonly id: EnvId;
  /** Display name, e.g. "Racing". */
  readonly label: string;
  /** Bumped whenever a change could alter this env's results. Runs and references store it. */
  readonly engineVersion: number;
  readonly tickHz: number;
  /** Per agent layout of the population and ghost streams. */
  readonly snapshot: SnapshotLayout;
  readonly outputs: readonly OutputSpec[];
  /** Stats the env records per generation, in the order the lab shows them. */
  readonly metrics: readonly MetricSpec[];

  /** The preset brains, simplest first. The lab picks which one a new run starts on. */
  readonly blueprints: readonly Blueprint[];
  /** Brain inputs the blueprint's built in sensors produce, before script sensors. */
  inputCount(inputs: unknown): number;
  /** Problems with a blueprint's sensor config, for the blueprint form and imports. */
  validateInputs?(inputs: unknown): BlueprintIssue[];
  /** Every brain input of a run in observation order, script sensors last. */
  inputSchema(config: RunConfig, custom?: readonly CustomSensorSpec[]): InputSpec[];
  /** Hash of the rules a run freezes (physics, sensors), stored as the run's physicsHash. */
  physicsHash(config: RunConfig): string;

  /** The benchmark. Its `run` loads the exam on first use, so the info stays light. */
  bench?: EpisodeBench;
  /** What lessons can check, for the lesson validator and the Studio. The module adds the runtime half. */
  lessons?: EpisodeLessonsInfo;

  /**
   * Loads the module, written as `() => import('./module').then((m) => m.myModule)`
   * so the simulation lands in a chunk of its own.
   */
  load(): Promise<AnyEpisodeModule>;
}

/**
 * One single population environment: its info plus the simulation.
 * `Content` is what the population trains on right now (Racing: the track;
 * Driving: a city, level and route seed; Navigation: a level and course
 * seed). It is plain data, kept in checkpoints, and changed by the script's
 * generation block or by the env's own curriculum.
 */
export interface EpisodeEnvModule<Setup extends EpisodeSetup = EpisodeSetup, Content = unknown, R extends EpisodeResult = EpisodeResult, C extends ChampionRecord = ChampionRecord>
  extends Omit<EpisodeEnvInfo, 'lessons'> {
  initialContent(config: RunConfig): Content;
  /** The content for the next generation as a new object, or null to keep it. `reset` means old scores no longer compare. */
  nextContent(step: ContentStep<Content, R>): { content: Content; reset: boolean } | null;
  /** Stored on every record as `trackHash`, so a path or replay knows what it ran on. */
  contentHash(content: Content): string;
  /**
   * Set when the content changes during a run in ways its hash cannot
   * rebuild, such as a curriculum level or a route seed. Every record then
   * keeps the content it ran on, so a branch resumes on it and a lab can
   * replay a champion on its own episode. Keep such content small: a level
   * and a seed, not a built course. Racing leaves it out.
   */
  readonly contentOnRecords?: boolean;
  createSetup(input: SetupInput<Content>): Setup;
  /** Builds an episode. The script controller comes from `host`; null means the env's built in reward. */
  createEnv(setup: Setup, host: ScriptHost, seed: number): EpisodeEnv<R>;
  /**
   * Start slots for a generation of `count` agents, one each, in an order
   * seeded by `seed` (mixed from the run seed and the generation). Left
   * out, training passes no slots. With it, the trainer hands agent i
   * slot i of this list in every worker, and the champion's record keeps
   * its slot (replaySlot) so a replay starts on the same spot.
   */
  startSlots?(count: number, seed: number): number[];

  championFields(result: R): ChampionFields<C>;
  /** Stats over the whole generation, keyed like `metrics` with source 'generation'. */
  generationMetrics?(results: readonly R[], content: Content): Record<string, number>;

  telemetry?: GhostTrace<R>;
  lessons?: EpisodeLessons<R>;
}

/** Any registered module, with its type parameters erased for generic code. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyEpisodeModule = EpisodeEnvModule<any, any, any, any>;
