import type { MatchResult, MatchSpec } from '@/engine/hideseek/match/types';
import type { HideSeekGenerationStats } from '@/engine/hideseek/trainer/types';
import type { HideSeekTrainer } from '@/engine/hideseek/trainer/trainer';
import { cloneGenome } from '@/engine/neat/genome';
import { buildRoundReplay, type HideSeekRecord, type RoundReplay } from '@/engine/training/hideseekRecords';

/**
 * Packs the last round of a plan for replay. Called before the generation
 * completes, and the genomes are copied, because breeding the next
 * generation reuses the population objects the plan points at.
 */
export function lastRoundReplay(plan: MatchSpec[][], generation: number, scriptSource: string | null): RoundReplay {
  const round = plan.length - 1;
  const replay = buildRoundReplay(plan[round], { generation, round, rounds: plan.length, scriptSource });
  return { ...replay, genomes: replay.genomes.map((g) => cloneGenome(g)) };
}

/** Seconds of play across all matches, both agents counted once per match. */
export function simulatedSeconds(results: MatchResult[][], dt: number): number {
  let ticks = 0;
  for (const round of results) for (const r of round) ticks += r.ticks;
  return ticks * dt;
}

/**
 * The record of a generation the trainer just completed. Champions are the
 * newest hall of fame entries, which the trainer adds from the scored
 * population before breeding.
 */
export function generationRecord(
  runId: string,
  trainer: HideSeekTrainer,
  stats: HideSeekGenerationStats,
  replay: RoundReplay,
  results: MatchResult[][],
  wallMs: number,
): HideSeekRecord {
  const hiders = trainer.hallOfFame.hiders.toState();
  const seekers = trainer.hallOfFame.seekers.toState();
  return {
    runId,
    generation: stats.generation,
    stats,
    hiderChampion: hiders[hiders.length - 1].genome,
    seekerChampion: seekers[seekers.length - 1].genome,
    replay,
    simSeconds: simulatedSeconds(results, trainer.options.physics.dt),
    wallMs,
  };
}
