import { MAX_SANDBOX_CARS } from '@/engine/driving/sandbox';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import type { GhostSpec } from '@/workers/replay/ghostPlayer';
import { ghostSpecs } from '@/features/lab/session/ghostSelection';

/** One row of the Sandbox field: a stored champion and how many copies of it line up. */
export interface FieldEntry {
  generation: number;
  copies: number;
}

export function fieldSize(field: readonly FieldEntry[]): number {
  return field.reduce((n, e) => n + e.copies, 0);
}

/** How many SUVs the Sandbox lines up the first time it opens: enough to compare, few enough to tell apart. */
export const STARTING_FIELD = 4;

/**
 * Each chosen generation once, newest first. With more than `cap`, they
 * are thinned evenly and the oldest and newest are kept, so the line still
 * spans the whole run rather than its last few generations.
 */
export function fieldFromGenerations(gens: readonly number[], cap = MAX_SANDBOX_CARS): FieldEntry[] {
  const all = [...new Set(gens)].sort((a, b) => a - b);
  const keep = all.length <= cap ? all : cap <= 1 ? all.slice(-1) : Array.from({ length: cap }, (_, i) => all[Math.round((i * (all.length - 1)) / (cap - 1))]);
  return [...new Set(keep)].sort((a, b) => b - a).map((generation) => ({ generation, copies: 1 }));
}

/**
 * Sets how many copies of a champion start, adding the row if it is new and
 * dropping it at zero. The total never passes `max`. Rows stay newest first.
 */
export function setCopies(field: readonly FieldEntry[], generation: number, copies: number, max = MAX_SANDBOX_CARS): FieldEntry[] {
  const others = field.filter((e) => e.generation !== generation);
  const room = max - fieldSize(others);
  const n = Math.max(0, Math.min(Math.round(copies), room));
  const next = n > 0 ? [...others, { generation, copies: n }] : others;
  return next.sort((a, b) => b.generation - a.generation);
}

export function copiesOf(field: readonly FieldEntry[], generation: number): number {
  return field.find((e) => e.generation === generation)?.copies ?? 0;
}

/** What the replay worker gets for a field: one spec per SUV, plus each one's generation in stream order. */
export interface FieldScene {
  specs: GhostSpec[];
  generations: number[];
}

/**
 * Expands the field into one ghost per SUV. Champions go oldest first, the
 * order the ghost colors ramp in, while the line fills newest first so the
 * newest champion starts in front. A champion's copies run front to back,
 * because the lab finds a champion's SUV by its first copy. Rows without a
 * stored record are skipped, and the line stops at `max` SUVs.
 */
export function fieldScene(run: RunConfig, records: GenerationRecord[], field: readonly FieldEntry[], max = MAX_SANDBOX_CARS): FieldScene {
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
  const kept = cars.filter((c) => (c.slot ?? 0) < max);
  return { specs: kept, generations: kept.map((c) => c.generation) };
}
