import { HIDESEEK_BENCHMARK_VERSION, HIDESEEK_ENGINE_VERSION } from '../../core/version';
import { HIDESEEK_LAYOUTS, HIDESEEK_LAYOUT_IDS } from '../../hideseek/layouts/presets';
import type { BenchResult, ReferenceTier } from '../types';
import { performanceRating } from './elo';
import { composite, partScore, summarize, type GameSummary } from './scoring';
import type { ExamOpponent, GameResult } from './types';

const TIER_NAMES: Record<ReferenceTier, string> = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };

/** The raw numbers of a group of games, as BenchResult metrics. */
function metricsOf(s: GameSummary): Record<string, number> {
  return { hiddenShare: s.hiddenShare, seenShare: s.seenShare, winRate: s.winRate, coverShare: s.coverShare, locksPerMatch: s.locksPerMatch, games: s.games };
}

/**
 * The model's Elo-style rating: the performance rating against the
 * references' fixed ratings, from the points it won against each.
 */
export function examRating(games: readonly GameResult[], opponents: readonly ExamOpponent[]): number {
  const records = opponents.map((o) => {
    const s = summarize(games.filter((g) => g.opponent === o.tier));
    return { opponent: o.rating, points: s.winRate * s.games, games: s.games };
  });
  return performanceRating(records.filter((r) => r.games > 0));
}

/**
 * Turns the exam's games into a benchmark result. Parts come first by
 * opponent (ids like "vs:advanced"), then by room (ids like "room:open").
 * `parameters` is the weight count of both brains together, since the
 * pair is what was scored.
 */
export function hideSeekResult(games: readonly GameResult[], opponents: readonly ExamOpponent[], parameters: number): BenchResult {
  const all = summarize(games);
  const rooms = HIDESEEK_LAYOUT_IDS.map((id) => ({ id, s: summarize(games.filter((g) => g.layout === id)) })).filter((r) => r.s.games > 0);
  const versus = opponents.map((o) => ({ tier: o.tier, s: summarize(games.filter((g) => g.opponent === o.tier)) }));
  const { radar, score } = composite(
    all,
    rooms.map((r) => r.s),
  );
  return {
    env: 'hideseek',
    benchmarkVersion: HIDESEEK_BENCHMARK_VERSION,
    engineVersion: HIDESEEK_ENGINE_VERSION,
    score,
    radar,
    metrics: { ...metricsOf(all), elo: examRating(games, opponents) },
    parts: [
      ...versus.map(({ tier, s }) => ({ id: `vs:${tier}`, label: `Against ${TIER_NAMES[tier]}`, score: partScore(s), metrics: metricsOf(s) })),
      ...rooms.map(({ id, s }) => ({ id: `room:${id}`, label: HIDESEEK_LAYOUTS[id].name, score: partScore(s), metrics: metricsOf(s) })),
    ],
    scorePer100Params: (100 * score) / Math.max(1, parameters),
  };
}
