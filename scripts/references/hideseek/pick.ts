import { fitRatings, type Pairing } from '../../../src/engine/bench/hideseek/elo';
import { encodeChampion, opponentOf } from '../../../src/engine/bench/hideseek/opponents';
import { summarize } from '../../../src/engine/bench/hideseek/scoring';
import type { GameResult } from '../../../src/engine/bench/hideseek/types';
import type { ReferenceChampion, ReferenceTier } from '../../../src/engine/bench/types';
import { hideSeekBlueprints } from '../../../src/engine/training/hideseekRunConfig';
import type { HideSeekTrainResult } from './train';
import type { HideSeekYardstickResult } from './yardstick';

/** The final champion pair of one reference run, as a not yet rated reference champion. */
export function finalChampion(run: HideSeekTrainResult): ReferenceChampion {
  const last = run.pairs[run.pairs.length - 1];
  const bp = hideSeekBlueprints(run.config);
  return encodeChampion({
    tier: run.job.tier,
    seed: run.job.seed,
    generation: last.generation,
    rating: 0,
    hider: { genome: last.hider, inputs: bp.hider.inputs },
    seeker: { genome: last.seeker, inputs: bp.seeker.inputs },
  });
}

/**
 * Each tier's reference champion: the final pair of the seed in the middle
 * of the tier, ranked by hidden plus seen share against the hand-written
 * agents. The middle seed is typical of the preset, where the best or the
 * first seed could be a lucky or unlucky one. Ties go to the lower seed.
 */
export function pickChampions(runs: HideSeekTrainResult[], yardsticks: Map<string, HideSeekYardstickResult>, tiers: readonly ReferenceTier[]): ReferenceChampion[] {
  return tiers.map((tier) => {
    const ranked = runs
      .filter((r) => r.job.tier === tier)
      .map((r) => {
        const y = yardsticks.get(`${tier}:${r.job.seed}`);
        return { run: r, skill: (y?.hidden ?? 0) + (y?.seen ?? 0) };
      })
      .sort((a, b) => a.skill - b.skill || a.run.job.seed - b.run.job.seed);
    const middle = ranked[Math.floor((ranked.length - 1) / 2)];
    if (!middle) throw new Error(`No reference runs for tier ${tier}.`);
    return finalChampion(middle.run);
  });
}

/**
 * Rates the reference champions from their own exams, which play each of
 * them against all three, so the exam is also the round robin. Every
 * pairing is played from both sides with the same matches, so one side of
 * each is enough. A reference measured by the exam afterwards gets its
 * rating back, because the exam's rating is the same fit.
 */
export function rateChampions(champions: ReferenceChampion[], gamesOf: (tier: ReferenceTier) => GameResult[]): ReferenceChampion[] {
  const pairings: Pairing[] = [];
  champions.forEach((a, i) =>
    champions.forEach((b, j) => {
      if (j <= i) return;
      const s = summarize(gamesOf(a.tier).filter((g) => g.opponent === b.tier));
      pairings.push({ a: i, b: j, points: s.winRate * s.games, games: s.games });
    }),
  );
  const ratings = fitRatings(champions.length, pairings);
  return champions.map((c, i) => ({ ...c, rating: Math.round(ratings[i] * 10) / 10 }));
}

/** Decodes the champions once, so a bad genome fails here and not in a worker. */
export function checkChampions(champions: ReferenceChampion[]): void {
  champions.forEach(opponentOf);
}
