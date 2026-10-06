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
 * Most cars the Sandbox races at once. Sixteen fill a grid about 90 m long,
 * which fits behind the line on every built in track, and the replay
 * worker still steps them all in well under a frame.
 */
export const MAX_FIELD = 16;

export function fieldSize(field: readonly FieldEntry[]): number {
  return field.reduce((n, e) => n + e.copies, 0);
}

/** Each chosen generation once, newest kept first when there are more than fit. */
export function fieldFromGenerations(gens: readonly number[]): FieldEntry[] {
  return [...new Set(gens)]
    .sort((a, b) => b - a)
    .slice(0, MAX_FIELD)
    .map((generation) => ({ generation, copies: 1 }));
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
 * Expands the field into one ghost per car. Cars go oldest first, the order
 * the ghost colors ramp in, and grid slots run the other way so the newest
 * champion takes pole. The camera follows the last car by default, so that
 * is the car on pole. Rows without a stored record are skipped.
 */
export function fieldScene(run: RunConfig, records: GenerationRecord[], field: readonly FieldEntry[]): FieldScene {
  const rows = [...field].sort((a, b) => a.generation - b.generation);
  const base = new Map(ghostSpecs(run, records, rows.map((r) => r.generation)).map((s) => [s.generation, s]));
  const cars: GhostSpec[] = [];
  for (const row of rows) {
    const spec = base.get(row.generation);
    if (spec) for (let k = 0; k < row.copies && cars.length < MAX_FIELD; k++) cars.push({ ...spec });
  }
  cars.forEach((car, i) => (car.slot = cars.length - 1 - i));
  return { specs: cars, generations: cars.map((c) => c.generation) };
}
