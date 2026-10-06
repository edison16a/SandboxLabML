import { startMatch } from '../../hideseek/match/runMatch';
import type { MatchResult, MatchSpec } from '../../hideseek/match/types';
import { HideSeekTrainer } from '../../hideseek/trainer/trainer';
import type { HideSeekGenerationStats } from '../../hideseek/trainer/types';
import { createHideSeekRunConfig } from '../../training/hideseekRunConfig';
import { hideSeekControllers, hideSeekSensorCounts, hideSeekTrainerOptions } from '../../training/hideseekSetup';
import { hostFor, type ScriptHost } from '../../training/scriptHost';
import { linkScriptCompiler } from '../compilerLink';
import type { PreparedHideSeek } from '../prepare';
import type { HideSeekTrainingMetrics } from './metrics';
import { lessonArenaPool, playMatch } from './play';

/**
 * Brains per team. Tiny next to a real run's 50, so a generation of a
 * typical script (24 matches of 30 s) plays in about two seconds, and
 * fixed, so every learner gets the same answer. Lesson targets are set
 * for this size.
 */
export const LESSON_TEAM_SIZE = 4;
export const LESSON_HIDESEEK_SEED = 2024;

export interface HideSeekTrainingOptions {
  onProgress?: (fraction: number) => void;
  signal?: AbortSignal;
}

/** Where metrics start before the first generation: highs at their lowest, counts at 0. */
const EMPTY: HideSeekTrainingMetrics = {
  hiderBest: -Infinity,
  seekerBest: -Infinity,
  hiddenShare: 0,
  seenShare: 0,
  currentHiddenShare: 0,
  scriptedHiddenShare: 0,
  scriptedSeenShare: 0,
  grabsPerMatch: 0,
  locksPerMatch: 0,
  boxesMovedPerMatch: 0,
  matches: 0,
  hallOfFameMatches: 0,
  hallOfFame: 0,
  hiderSpecies: 0,
  seekerSpecies: 0,
};

/** A hall of fame match has one side from the hall: a past champion, so not a scored slot, and not a scripted agent. */
function againstHallOfFame(spec: MatchSpec): boolean {
  const { hider, seeker } = spec;
  if (hider.scripted || seeker.scripted) return false;
  return (hider.slot ?? -1) < 0 || (seeker.slot ?? -1) < 0;
}

/** Folds one generation into the running metrics: highs for game numbers, latest for counts. */
function fold(m: HideSeekTrainingMetrics, stats: HideSeekGenerationStats, plan: MatchSpec[][]): void {
  const g = stats.game;
  const high = (key: keyof HideSeekTrainingMetrics, v: number) => (m[key] = Math.max(m[key], v));
  high('hiderBest', stats.hiders.best);
  high('seekerBest', stats.seekers.best);
  high('hiddenShare', g.hiddenShare);
  high('seenShare', g.seenShare);
  high('currentHiddenShare', g.currentHiddenShare);
  high('scriptedHiddenShare', g.scriptedHiddenShare ?? 0);
  high('scriptedSeenShare', g.scriptedSeenShare ?? 0);
  high('grabsPerMatch', g.grabsPerMatch);
  high('locksPerMatch', g.locksPerMatch);
  high('boxesMovedPerMatch', g.boxesMovedPerMatch);
  high('matches', g.matches);
  high('hallOfFameMatches', plan.flat().filter(againstHallOfFame).length);
  m.hallOfFame = g.hallOfFame.hiders;
  m.hiderSpecies = stats.hiders.species.length;
  m.seekerSpecies = stats.seekers.species.length;
}

/** A trainer set up the way the lab sets up a new run with this script, only smaller. */
function lessonTrainer(prepared: PreparedHideSeek, host: ScriptHost): HideSeekTrainer {
  const blueprint = prepared.blueprint;
  if (!blueprint) throw new Error('Training checks need a Hide and Seek brain.');
  const { script, source } = prepared;
  const config = createHideSeekRunConfig({
    name: 'Lesson check',
    seed: LESSON_HIDESEEK_SEED,
    blueprint,
    populationPerTeam: LESSON_TEAM_SIZE,
    script: { source, hash: script.sourceHash, customSensors: script.sensors.length },
  });
  return HideSeekTrainer.create(hideSeekTrainerOptions(config, hideSeekSensorCounts(host)), host);
}

/**
 * Trains a lesson script headless with the real HideSeekTrainer, so the
 * script's rewards, its generation block and the hall of fame behave
 * exactly as in the lab. Every match is played in slices with pauses in
 * between, so a tab stays responsive. Returns null if the signal aborts.
 */
export async function trainHideSeekLesson(prepared: PreparedHideSeek, generations: number, opts: HideSeekTrainingOptions = {}): Promise<HideSeekTrainingMetrics | null> {
  linkScriptCompiler();
  const host = hostFor(prepared.source);
  const trainer = lessonTrainer(prepared, host);
  const pool = await lessonArenaPool();
  const metrics = { ...EMPTY };
  for (let g = 0; g < generations; g++) {
    const plan = trainer.planGeneration();
    const total = plan.reduce((n, round) => n + round.length, 0);
    let played = 0;
    const results: MatchResult[][] = [];
    for (const round of plan) {
      const out: MatchResult[] = [];
      for (const spec of round) {
        const match = startMatch(spec, pool, hideSeekControllers(host, spec.seed));
        try {
          if (!(await playMatch(match, opts.signal))) return null;
          out.push(match.result());
        } finally {
          match.release();
        }
        opts.onProgress?.((g + ++played / total) / generations);
      }
      results.push(out);
    }
    fold(metrics, trainer.completeGeneration(results, {}, host), plan);
  }
  return metrics;
}
