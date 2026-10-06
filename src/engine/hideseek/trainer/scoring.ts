import type { MatchResult, MatchSpec } from '../match/types';
import type { HideSeekMatchStats } from './types';

export interface GenerationScores {
  /** Mean reward per genome over its scored matches, in population order. */
  hiderFitness: Float64Array;
  seekerFitness: Float64Array;
  game: Omit<HideSeekMatchStats, 'hallOfFame'>;
}

/**
 * Turns a generation's results into fitness and game stats. A genome's
 * fitness is its mean reward over the matches where it sat in a scored
 * slot, so a genome is never rewarded for being someone's opponent.
 * Results must line up with the plan, round by round and match by match.
 */
export function scoreGeneration(plan: MatchSpec[][], results: MatchResult[][], hiderCount: number, seekerCount: number): GenerationScores {
  if (results.length !== plan.length || results.some((round, r) => round.length !== plan[r].length)) {
    throw new Error('Results do not match the planned rounds.');
  }
  const hSum = new Float64Array(hiderCount);
  const hN = new Float64Array(hiderCount);
  const sSum = new Float64Array(seekerCount);
  const sN = new Float64Array(seekerCount);
  let n = 0;
  let hidden = 0;
  let seen = 0;
  let current = 0;
  let currentHidden = 0;
  let locks = 0;
  let moved = 0;
  let grabs = 0;
  plan.forEach((round, r) =>
    round.forEach((spec, k) => {
      const res = results[r][k];
      const hs = spec.hider.slot ?? -1;
      const ss = spec.seeker.slot ?? -1;
      if (hs >= 0) {
        hSum[hs] += res.hiderReward;
        hN[hs]++;
      }
      if (ss >= 0) {
        sSum[ss] += res.seekerReward;
        sN[ss]++;
      }
      if (hs >= 0 && ss >= 0) {
        current++;
        currentHidden += res.hiddenShare;
      }
      n++;
      hidden += res.hiddenShare;
      seen += res.seenShare;
      locks += res.locksPlaced;
      moved += res.boxesMoved;
      grabs += res.hiderGrabs + res.seekerGrabs;
    }),
  );
  const mean = (sum: Float64Array, count: Float64Array) => sum.map((v, i) => (count[i] > 0 ? v / count[i] : 0));
  const per = (v: number) => (n > 0 ? v / n : 0);
  return {
    hiderFitness: mean(hSum, hN),
    seekerFitness: mean(sSum, sN),
    game: {
      matches: n,
      hiddenShare: per(hidden),
      seenShare: per(seen),
      currentHiddenShare: current > 0 ? currentHidden / current : 0,
      locksPerMatch: per(locks),
      boxesMovedPerMatch: per(moved),
      grabsPerMatch: per(grabs),
    },
  };
}
