import { opponentOf } from '../../../src/engine/bench/hideseek/opponents';
import { playExam } from '../../../src/engine/bench/hideseek/runner';
import type { ExamSide, GameResult } from '../../../src/engine/bench/hideseek/types';
import type { ReferenceChampion } from '../../../src/engine/bench/types';
import type { HideSeekInputConfig } from '../../../src/engine/hideseek/inputConfig';
import { createArenaPool, type ArenaPool } from '../../../src/engine/hideseek/world/pool';
import { modelMetrics } from '../../../src/engine/neat/metrics';
import type { Genome } from '../../../src/engine/neat/types';

/** A brain to examine. Reference runs train preset scripts, which add no script sensors. */
export interface ExamBrain {
  genome: Genome;
  inputs: HideSeekInputConfig;
}

/**
 * One exam to play in a worker: a champion pair against the reference
 * champions. `id` lets the caller match results to checkpoints.
 */
export interface HideSeekExamJob {
  kind: 'hideseek-exam';
  id: string;
  hider: ExamBrain;
  seeker: ExamBrain;
  opponents: ReferenceChampion[];
}

export interface HideSeekExamResult {
  id: string;
  games: GameResult[];
  /** Weights in both brains, for the score per 100 parameters. */
  parameters: number;
}

let pool: Promise<ArenaPool> | null = null;

/** Plays one exam with the engine's own exam code, on one Rapier pool per thread. */
export async function runHideSeekExam(job: HideSeekExamJob): Promise<HideSeekExamResult> {
  pool ??= createArenaPool();
  const side: ExamSide = {
    hider: { genome: job.hider.genome, inputs: job.hider.inputs, sensors: null },
    seeker: { genome: job.seeker.genome, inputs: job.seeker.inputs, sensors: null },
  };
  const games = await playExam(await pool, side, job.opponents.map(opponentOf));
  if (!games) throw new Error('The exam stopped early.');
  return { id: job.id, games, parameters: modelMetrics(job.hider.genome).parameters + modelMetrics(job.seeker.genome).parameters };
}
