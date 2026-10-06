import { examStarts, HS_BENCH_PHYSICS } from '../../../src/engine/bench/hideseek/exam';
import { runMatch } from '../../../src/engine/hideseek/match/runMatch';
import { createArenaPool, type ArenaPool } from '../../../src/engine/hideseek/world/pool';
import type { ExamBrain } from './exam';

/**
 * Scores a champion pair against the hand-written agents, which needs no
 * reference champions. The generator uses it to pick each tier's
 * reference among the seeds before any reference exists to play against.
 */
export interface HideSeekYardstickJob {
  kind: 'hideseek-yardstick';
  id: string;
  hider: ExamBrain;
  seeker: ExamBrain;
}

export interface HideSeekYardstickResult {
  id: string;
  /** Mean share of the seek phase the hider stayed hidden from the scripted seeker. */
  hidden: number;
  /** Mean share of the seek phase the seeker saw the scripted hider. */
  seen: number;
}

let pool: Promise<ArenaPool> | null = null;

/**
 * Every exam start, once per role. The scripted agent's stand-in genome is
 * the pair's other brain, which only has to have the right shape.
 */
export async function runHideSeekYardstick(job: HideSeekYardstickJob): Promise<HideSeekYardstickResult> {
  pool ??= createArenaPool();
  const p = await pool;
  const hider = { genome: job.hider.genome, inputs: job.hider.inputs };
  const seeker = { genome: job.seeker.genome, inputs: job.seeker.inputs };
  let hidden = 0;
  let seen = 0;
  const starts = examStarts();
  for (const { layout, seed } of starts) {
    hidden += runMatch({ layout, seed, hider, seeker: { ...seeker, scripted: true }, physics: HS_BENCH_PHYSICS }, p).hiddenShare;
    seen += runMatch({ layout, seed, hider: { ...hider, scripted: true }, seeker, physics: HS_BENCH_PHYSICS }, p).seenShare;
  }
  return { id: job.id, hidden: hidden / starts.length, seen: seen / starts.length };
}
