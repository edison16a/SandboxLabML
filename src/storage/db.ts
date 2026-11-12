import Dexie, { type Table } from 'dexie';
import type { Blueprint } from '@/engine/blueprints/types';
import type { EnvId } from '@/engine/env/types';
import type { GenerationStats } from '@/engine/neat/stats';
import type { ChampionRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';

/** One row per run, shown on the Runs page. Summary fields avoid loading history. */
export interface RunRow {
  id: string;
  name: string;
  env: EnvId;
  config: RunConfig;
  createdAt: number;
  updatedAt: number;
  generation: number;
  bestFitness: number;
  /** Best value of each env metric so far, in the direction it prefers, keyed like the env's metrics. */
  best?: Record<string, number>;
  benchmark?: number;
  /** Soft delete: set when moved to Trash, purged 7 days later. */
  deletedAt?: number;
}

/** One row per finished generation. The champion genome is stored in the binary format. */
export interface GenerationRow {
  runId: string;
  generation: number;
  stats: GenerationStats;
  champion: ChampionRecord;
  genome: Uint8Array;
  trackHash: string;
  replaySeed: number;
  /** The champion's start slot, for envs that hand out slots. */
  replaySlot?: number;
  simSeconds: number;
  wallMs: number;
  markers?: string[];
  benchmark?: number;
  /** Stats over the whole generation, from the env module. */
  metrics?: Record<string, number>;
  /** The content the generation ran on, for envs whose module keeps it (contentOnRecords). */
  content?: unknown;
}

/** Whole-population snapshots. Only the newest three per run are kept. */
export interface CheckpointRow {
  runId: string;
  generation: number;
  createdAt: number;
  state: unknown;
  bytes: number;
}

export interface ScriptRow {
  id: string;
  name: string;
  env: EnvId;
  source: string;
  /** Block editor layout (collapsed state and order hints), kept apart from the source. */
  layout: unknown;
  tier: 'beginner' | 'intermediate' | 'advanced' | 'custom';
  apiVersion: number;
  schemaVersion: number;
  updatedAt: number;
  /** The last 20 saved versions, newest first. */
  history: Array<{ savedAt: number; source: string }>;
}

export interface BlueprintRow {
  id: string;
  env: EnvId;
  blueprint: Blueprint;
  updatedAt: number;
}

export interface PathCacheRow {
  runId: string;
  generation: number;
  trackHash: string;
  /** Quantized x, y per tick as Int16 (decimeters relative to the world bounds). */
  path: Int16Array;
}

export interface LessonProgressRow {
  id: string;
  step: number;
  completed: boolean;
  source: string;
  updatedAt: number;
}

export interface BenchmarkRow {
  runId: string;
  generation: number;
  benchmarkVersion: number;
  score: number;
  detail: unknown;
  createdAt: number;
}

/**
 * A generation of a two team run, from a lab this version no longer has.
 * Nothing writes these rows any more. Only their keys are read, so that
 * destroying such a run still frees its rows.
 */
export interface RetiredGenerationRow {
  runId: string;
  generation: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

/** A Navigation course the user drew in the Sandbox editor. `spec` is a CourseSpec as plain data, cleaned on read. */
export interface CourseRow {
  id: string;
  spec: unknown;
  createdAt: number;
  updatedAt: number;
}

/**
 * The only IndexedDB code in the app. Everything else goes through the
 * repository functions in this folder.
 */
export class SandboxDb extends Dexie {
  runs!: Table<RunRow, string>;
  generations!: Table<GenerationRow, [string, number]>;
  checkpoints!: Table<CheckpointRow, [string, number]>;
  scripts!: Table<ScriptRow, string>;
  blueprints!: Table<BlueprintRow, string>;
  pathCache!: Table<PathCacheRow, [string, number, string]>;
  lessonProgress!: Table<LessonProgressRow, string>;
  benchmarks!: Table<BenchmarkRow, [string, number]>;
  settings!: Table<SettingRow, string>;
  hsGenerations!: Table<RetiredGenerationRow, [string, number]>;
  courses!: Table<CourseRow, string>;

  constructor(name = 'sandboxlab') {
    super(name);
    this.version(1).stores({
      runs: 'id, env, updatedAt, deletedAt',
      generations: '[runId+generation], runId',
      checkpoints: '[runId+generation], runId',
      scripts: 'id, env, updatedAt',
      blueprints: 'id, env',
      pathCache: '[runId+generation+trackHash], runId',
      lessonProgress: 'id',
      benchmarks: '[runId+generation], runId',
      settings: 'key',
    });
    // Versions 2 to 5 only add tables, so existing rows carry over untouched. The
    // tables of removed labs (hsGenerations, tracks, sandboxRooms) stay declared:
    // dropping one would need a new version, and their rows harm nothing.
    this.version(2).stores({ hsGenerations: '[runId+generation], runId' });
    this.version(3).stores({ tracks: 'id, updatedAt' });
    this.version(4).stores({ sandboxRooms: 'id, createdAt' });
    this.version(5).stores({ courses: 'id, createdAt' });
  }
}

let instance: SandboxDb | null = null;

/** Lazily opened so server rendering never touches IndexedDB. */
export function db(): SandboxDb {
  if (!instance) instance = new SandboxDb();
  return instance;
}

/** Tests swap in a fresh database. */
export function setDb(next: SandboxDb): void {
  instance = next;
}
