/**
 * The optional hooks of an env module: benchmark, ghost telemetry and
 * lessons. Lessons come in a light half, which the env's info carries for
 * the main thread, and a runtime half that only the module has.
 */
import type { BenchOptions, BenchResult } from '../bench/types';
import type { Genome, GenomeShape } from '../neat/types';
import type { RunConfig } from '../training/runConfig';
import type { EpisodeEnv, EpisodeResult } from './episode';
import type { InputSpec } from './types';

/**
 * The benchmark: held out content and a score from 0 to 100 that ignores
 * the training reward. It lives on the info, because `run` loads its exam
 * on first use, so the light half never pulls the exam in.
 */
export interface EpisodeBench {
  version: number;
  /** Radar axes in drawing order, clockwise from the top. */
  axes: ReadonlyArray<{ key: string; label: string }>;
  /** Shown beside the benchmark chart, e.g. "unseen tracks, 0 to 100". */
  hint: string;
  /** What the chart says before the first score lands, in one sentence. */
  about: string;
  run(config: RunConfig, genome: Genome, opts?: BenchOptions): Promise<BenchResult | null>;
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

/**
 * What Studio lessons can check on an env, as far as the main thread needs
 * to know: names, the default brain and how values read. Optional: an env
 * without it has no lessons yet. A test run is one headless episode of the
 * script with a fixed brain; a training check trains a small population
 * briefly and measures bestFitness, species and every key of the module's
 * `metrics`, at the best any generation reached.
 */
export interface EpisodeLessonsInfo {
  /** How a check names one test episode, such as "a test drive". */
  testRunName: string;
  /** What a test run measures besides totalReward, ticks and inputs. */
  testRunMetrics: readonly string[];
  /** Brain a lesson script trains when it names none. */
  brain: string;
  /** Wording of a measured value in a check outcome, such as (v) => `${v} m`. */
  formats?: Readonly<Record<string, (value: number) => string>>;
  /** Short names of the test run metrics for the Studio's result tiles, such as "Arrived". Left out, the key is shown. */
  labels?: Readonly<Record<string, string>>;
}

/** The runtime half of the lesson hooks, which runs episodes. */
export interface EpisodeLessons<R extends EpisodeResult> extends EpisodeLessonsInfo {
  /** The env numbers of one finished test episode, keyed like testRunMetrics. */
  measure(result: R): Record<string, number>;
  /** Run settings for lesson checks. Short episodes keep a check to a few seconds. */
  settings(): Readonly<Record<string, unknown>>;
  /** The fixed hand set brain of every test run, so a test means the same thing for every brain shape. */
  testBrain(shape: GenomeShape, schema: readonly InputSpec[]): Genome;
  /**
   * What the lesson preview adds to the recording. The recorder plays the
   * same test episode a check runs and keeps every snapshot, world block,
   * ray and reward. Left out, the Studio draws the agent's trail from its
   * snapshot's x and y (or z) fields alone.
   */
  preview?: EpisodePreviewHook<R>;
}

/** World meters, with the second axis named y for every env. */
export interface PreviewBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** What an env adds to its lesson preview, read once from the freshly reset test episode. */
export interface EpisodePreviewHook<R extends EpisodeResult> {
  /**
   * The still parts of the scene as plain data (it is posted from a
   * worker), such as walls and spikes or the streets near the route. The
   * env's Studio drawer reads it.
   */
  scene(env: EpisodeEnv<R>): unknown;
  /** The area the drawer should fit, when the trail alone would crop the scene. */
  bounds?(env: EpisodeEnv<R>): PreviewBounds;
}
