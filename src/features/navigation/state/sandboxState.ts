import type { ReferenceModel, ReferenceTier } from '@/engine/bench/types';
import type { CourseSpec } from '@/engine/navigation/course/types';
import type { NavigationParams } from '@/engine/navigation/params';
import type { NavigationInputConfig } from '@/engine/navigation/sensors/inputConfig';

/** Which course the Sandbox runs: a fresh course of a level, a named course, or one the user drew. */
export type SandboxCourse = { kind: 'level'; level: number; seed: number } | { kind: 'named'; id: string } | { kind: 'saved'; id: string };

/** One row of the Sandbox field: a stored champion of the run and how many copies of it line up. */
export interface FieldEntry {
  generation: number;
  copies: number;
}

/**
 * What the Sandbox last sent to the replay: its course and where each
 * runner starts. Until the replay streams that course, the viewport stands
 * the runners on those spots, so it never shows anything else.
 */
export interface SandboxLineup {
  spec: CourseSpec;
  /** The spec as JSON, to tell the replay's frames of this course from older ones. */
  key: string;
  params: NavigationParams;
  inputs: NavigationInputConfig;
  /** Each runner's seed and start slot, in stream order. Empty when nobody is lined up. */
  seeds: number[];
  slots: number[];
}

/**
 * The Sandbox setup. Runners come from the run (its stored champions, as
 * many copies of each as the user likes) or from a trained model shipped
 * with the app, so a newcomer sees a skilled runner before training one.
 */
export interface NavSandbox {
  course: SandboxCourse;
  /** The courses the user drew, from storage. */
  saved: CourseSpec[];
  source: 'run' | 'model';
  field: FieldEntry[];
  /** The shipped models, null until the reference file loads (or when it cannot). */
  models: ReferenceModel[] | null;
  model: ReferenceTier;
  modelCopies: number;
  paused: boolean;
  /** The inputs of the brains on screen, when they differ from the run's (a shipped model). The viewport's sensor drawing reads them. */
  inputs: NavigationInputConfig | null;
  /** The scene in play, set each time one is sent. Null while the Sandbox is closed. */
  lineup: SandboxLineup | null;
}

/** Most runners the Sandbox lines up: the front rows of the start grid, which the replay worker steps in well under a frame. */
export const MAX_RUNNERS = 40;
/** Copies of one champion the Sandbox lines up the first time it opens. */
export const STARTING_COPIES = 8;
/** Seed of the level courses the Sandbox offers until the user asks for a new layout. */
export const SANDBOX_SEED = 7;

export const SANDBOX_DEFAULTS: NavSandbox = {
  course: { kind: 'level', level: 1, seed: SANDBOX_SEED },
  saved: [],
  source: 'run',
  field: [],
  models: null,
  model: 'advanced',
  modelCopies: STARTING_COPIES,
  paused: false,
  inputs: null,
  lineup: null,
};

export const fieldSize = (field: readonly FieldEntry[]) => field.reduce((n, e) => n + e.copies, 0);

/**
 * Sets how many copies of a champion start, adding its row if it is new
 * and dropping it at zero. The total never passes MAX_RUNNERS. Rows stay
 * newest first, the order the panel lists them in.
 */
export function setCopies(field: readonly FieldEntry[], generation: number, copies: number): FieldEntry[] {
  const others = field.filter((e) => e.generation !== generation);
  const n = Math.max(0, Math.min(Math.round(copies), MAX_RUNNERS - fieldSize(others)));
  return (n > 0 ? [...others, { generation, copies: n }] : others).sort((a, b) => b.generation - a.generation);
}
