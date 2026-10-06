import { GRID_SLOTS } from '@/engine/racing/car/startGrid';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import type { GhostSpec } from '@/workers/replay/ghostPlayer';
import { ghostSpecs } from './ghostSelection';

/** One row of the Sandbox field: a stored champion and how many copies of it line up. */
export interface FieldEntry {
  generation: number;
  copies: number;
}

/**
 * Most cars the Sandbox races at once: the slots the start grid is laid out
 * for. The replay worker still steps them all in well under a frame.
 */
export const MAX_FIELD = GRID_SLOTS;

export function fieldSize(field: readonly FieldEntry[]): number {
  return field.reduce((n, e) => n + e.copies, 0);
}

/** How many cars the Sandbox lines up the first time it opens: enough for a race, few enough to tell apart. */
export const STARTING_FIELD = 8;

/**
 * Each chosen generation once, newest first. When there are more than
 * `cap`, they are thinned evenly and the oldest and newest are kept, so the
 * grid still spans the whole run rather than its last few generations.
 */
export function fieldFromGenerations(gens: readonly number[], cap = MAX_FIELD): FieldEntry[] {
  const all = [...new Set(gens)].sort((a, b) => a - b);
  const keep = all.length <= cap ? all : cap <= 1 ? all.slice(-1) : Array.from({ length: cap }, (_, i) => all[Math.round((i * (all.length - 1)) / (cap - 1))]);
  return [...new Set(keep)].sort((a, b) => b - a).map((generation) => ({ generation, copies: 1 }));
}

/**
 * Sets how many copies of a champion start, adding the row if it is new and
 * dropping it at zero. The total never goes past MAX_FIELD. Rows stay
 * newest first, the order the panel lists them in.
 */
export function setCopies(field: readonly FieldEntry[], generation: number, copies: number): FieldEntry[] {
  const others = field.filter((e) => e.generation !== generation);
  const room = MAX_FIELD - fieldSize(others);
  const n = Math.max(0, Math.min(Math.round(copies), room));
  const next = n > 0 ? [...others, { generation, copies: n }] : others;
  return next.sort((a, b) => b.generation - a.generation);
}

export function copiesOf(field: readonly FieldEntry[], generation: number): number {
  return field.find((e) => e.generation === generation)?.copies ?? 0;
}

/** What the replay worker gets for a field: one spec per car, plus each car's generation in stream order. */
export interface FieldScene {
  specs: GhostSpec[];
  generations: number[];
}

/**
 * Expands the field into one ghost per car. Champions go oldest first, the
 * order the ghost colors ramp in, while the grid fills newest first so the
 * newest champion takes pole. Within a champion its copies run front to
 * back, because the lab finds a champion's car by its first copy: following
 * it, or clicking any copy, lands on the one nearest the front. Rows
 * without a stored record are skipped.
 */
export function fieldScene(run: RunConfig, records: GenerationRecord[], field: readonly FieldEntry[]): FieldScene {
  const asked = [...field].sort((a, b) => a.generation - b.generation);
  const base = new Map(ghostSpecs(run, records, asked.map((r) => r.generation)).map((s) => [s.generation, s]));
  const rows = asked.filter((r) => base.has(r.generation));
  const firstSlot = new Map<number, number>();
  let taken = 0;
  for (const row of [...rows].reverse()) {
    firstSlot.set(row.generation, taken);
    taken += row.copies;
  }
  const cars: GhostSpec[] = [];
  for (const row of rows) {
    for (let k = 0; k < row.copies; k++) cars.push({ ...base.get(row.generation)!, slot: firstSlot.get(row.generation)! + k });
  }
  const kept = cars.filter((c) => (c.slot ?? 0) < MAX_FIELD);
  return { specs: kept, generations: kept.map((c) => c.generation) };
}
