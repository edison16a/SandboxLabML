import { mixSeed } from '../../core/rng';
import { HIDESEEK_LAYOUT_IDS } from '../../hideseek/layouts/presets';
import { DEFAULT_HIDESEEK_PHYSICS } from '../../hideseek/physics';
import type { ExamStart } from './types';

/**
 * Starts per room. Every start is one game of two matches against each
 * reference, so the exam plays 10 x 2 x 3 rooms x 3 references = 180
 * matches. Changing it changes scores, so bump HIDESEEK_BENCHMARK_VERSION.
 */
export const HS_BENCH_STARTS_PER_ROOM = 10;

/**
 * Salt for the start seeds. Training seeds every match with the run seed,
 * the generation, the round and the match index, so a fixed salt with two
 * small numbers keeps the exam's starts apart from anything a run plays.
 */
const HS_BENCH_SEED = 0x45b7;

/**
 * The rules every exam match is played under, whatever the run trained
 * with: the standard physics and the standard 9 s prep phase. A run's
 * custom rules or prep curriculum never reach the exam.
 */
export const HS_BENCH_PHYSICS = DEFAULT_HIDESEEK_PHYSICS;

/**
 * Checkpoints pooled into a Hide and Seek reference's final score. Both
 * teams co-evolve, so a single run swings by 10 to 25 points from one
 * checkpoint to the next; the last three (generations 40, 50 and 60 at the
 * nightly budget) of every seed give a steadier picture.
 */
export const HS_REFERENCE_FINAL_WINDOW = 3;

/** Matches the exam plays for each reference opponent. */
export function examMatchesPerOpponent(): number {
  return HIDESEEK_LAYOUT_IDS.length * HS_BENCH_STARTS_PER_ROOM * 2;
}

/** Every start of the exam, room by room, in the order they are played. The same list on every thread. */
export function examStarts(): ExamStart[] {
  return HIDESEEK_LAYOUT_IDS.flatMap((layout, room) => Array.from({ length: HS_BENCH_STARTS_PER_ROOM }, (_, k) => ({ layout, seed: mixSeed(HS_BENCH_SEED, room, k) })));
}
