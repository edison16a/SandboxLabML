import Dexie, { type Table } from 'dexie';
import type { Blueprint } from '@/engine/blueprints/types';
import type { EnvId } from '@/engine/env/types';
import type { TrackSpec } from '@/engine/racing/track/types';
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
  bestDistance: number;
  bestLapTime: number;
  benchmark?: number;
  /** Hide and Seek only: share of seek time the newest hiders stayed hidden from current seekers, 0 to 1. */
  hiddenShare?: number;
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
  simSeconds: number;
  wallMs: number;
  markers?: string[];
  benchmark?: number;
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
  /** Quantized x, y per tick as Int16 (decimeters relative to the track bounds). */
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
 * One Hide and Seek generation: both teams' stats and champions, plus game
 * stats such as hidden share. Kept apart from racing rows because the shape
 * differs (two populations per generation).
 */
export interface HideSeekGenerationRow {
  runId: string;
  generation: number;
  /** HideSeekGenerationStats from the engine, stored as plain data. */
  stats: unknown;
  hiderChampion: Uint8Array;
  seekerChampion: Uint8Array;
  /** Seeds and layouts of the last round, so the grid can replay it. */
  replay?: unknown;
  simSeconds: number;
  wallMs: number;
  benchmark?: number;
}

export interface SettingRow {
  key: string;
  value: unknown;
}

/** A track the user drew in the Racing Sandbox and saved under a name. */
export interface TrackRow {
  id: string;
  name: string;
  spec: TrackSpec;
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
  hsGenerations!: Table<HideSeekGenerationRow, [string, number]>;
  tracks!: Table<TrackRow, string>;

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
    this.version(2).stores({ hsGenerations: '[runId+generation], runId' });
    // Version 3 only adds a table, so existing rows carry over untouched.
    this.version(3).stores({ tracks: 'id, updatedAt' });
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
