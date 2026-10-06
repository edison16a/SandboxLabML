import { createArenaPool, type ArenaPool } from '../../hideseek/world/pool';
import { modelMetrics } from '../../neat/metrics';
import type { RunConfig } from '../../training/runConfig';
import { loadReferences } from '../references';
import type { BenchOptions } from '../runner';
import type { BenchReferences, BenchResult } from '../types';
import { examStarts } from './exam';
import { opponentsFrom } from './opponents';
import { playGame } from './play';
import { hideSeekResult } from './result';
import { examSideFor } from './side';
import type { ExamOpponent, ExamSide, GameResult, HideSeekModel } from './types';

export interface HideSeekBenchOptions extends BenchOptions {
  /** A pool to play on, such as a worker's shared one. Without it the exam loads Rapier and builds its own. */
  pool?: ArenaPool;
  /** The reference file, when the caller already has it. Node callers must pass it, the browser fetches it. */
  references?: BenchReferences | null;
}

const pause = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/**
 * Plays every game of the exam: each opponent in turn, every start of
 * every room, with a pause after each game so a page or worker stays
 * responsive. Returns null when the signal aborts.
 */
export async function playExam(pool: ArenaPool, model: ExamSide, opponents: readonly ExamOpponent[], opts: BenchOptions = {}): Promise<GameResult[] | null> {
  const starts = examStarts();
  const total = starts.length * opponents.length;
  const games: GameResult[] = [];
  for (const opponent of opponents) {
    for (const start of starts) {
      if (opts.signal?.aborted) return null;
      games.push(playGame(pool, start, model, opponent));
      opts.onProgress?.(games.length / total);
      await pause();
    }
  }
  return opts.signal?.aborted ? null : games;
}

/** Plays the exam on the given pool, or on a fresh one that is disposed afterwards. */
async function withPool<T>(pool: ArenaPool | undefined, play: (pool: ArenaPool) => Promise<T>): Promise<T> {
  const own = pool ? null : await createArenaPool();
  try {
    return await play(pool ?? (own as ArenaPool));
  } finally {
    own?.dispose();
  }
}

/**
 * Hide and Seek exam: the run's champion pair plays every reference
 * champion pair from fixed starts in every room, hiding in one leg and
 * seeking in the other. Throws when the references cannot be loaded or a
 * brain does not fit its run, and returns null when the signal aborts.
 */
export async function benchmarkHideSeek(config: RunConfig, model: HideSeekModel, opts: HideSeekBenchOptions = {}): Promise<BenchResult | null> {
  const side = examSideFor(config, model);
  const refs = opts.references ?? (await loadReferences('hideseek'));
  if (!refs) throw new Error('The Hide and Seek reference champions could not be loaded.');
  const opponents = opponentsFrom(refs);
  const games = await withPool(opts.pool, (pool) => playExam(pool, side, opponents, opts));
  if (!games) return null;
  const parameters = modelMetrics(model.hider).parameters + modelMetrics(model.seeker).parameters;
  return hideSeekResult(games, opponents, parameters);
}
