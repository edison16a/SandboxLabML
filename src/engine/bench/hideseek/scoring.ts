import type { HideSeekRadar } from '../types';
import type { GameResult } from './types';

/**
 * How much each part counts toward the 0 to 100 score. Winning games
 * against the references matters most, since it is the one number that
 * cancels out which role is easier. Changing any constant in this file
 * changes scores, so bump HIDESEEK_BENCHMARK_VERSION.
 */
export const HS_WEIGHTS = { winRate: 0.4, hiding: 0.2, seeking: 0.2, cover: 0.1, generalization: 0.1 } as const;

/**
 * How far apart the two legs of a game must be for a win, as a share of
 * the seek phase: about one second of the 21 s seek phase. Closer games
 * are draws, so a lucky tick never decides one.
 */
export const DRAW_MARGIN = 0.05;

/**
 * The model's points for one game: 1 for a win, 0.5 for a draw. The model
 * wins when its hider stayed hidden from the opponent's seeker longer than
 * the opponent's hider stayed hidden from the model's seeker, which is the
 * same as hidden plus seen above 1. Both legs start from the same spots,
 * so whichever role a room favors, it favors both players equally.
 */
export function gamePoints(g: GameResult): number {
  const lead = g.hidden + g.seen - 1;
  return lead > DRAW_MARGIN ? 1 : lead < -DRAW_MARGIN ? 0 : 0.5;
}

/** Averages over a group of games, each from 0 to 1 except locks. */
export interface GameSummary {
  games: number;
  hiddenShare: number;
  seenShare: number;
  coverShare: number;
  /** Boxes the model's hider locked per match. */
  locksPerMatch: number;
  winRate: number;
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

export function summarize(games: readonly GameResult[]): GameSummary {
  return {
    games: games.length,
    hiddenShare: mean(games.map((g) => g.hidden)),
    seenShare: mean(games.map((g) => g.seen)),
    coverShare: mean(games.map((g) => g.covered)),
    locksPerMatch: mean(games.map((g) => g.locks)),
    winRate: mean(games.map(gamePoints)),
  };
}

/**
 * The radar and the composite score. Hiding and seeking are the raw
 * shares against the references, cover is how much of the seek phase the
 * hider spent where the seeker could not have seen it even by turning,
 * and generalization is the win rate in the weakest room, so a model that
 * only learned one room scores low there.
 */
export function composite(all: GameSummary, rooms: readonly GameSummary[]): { radar: HideSeekRadar; score: number } {
  const radar: HideSeekRadar = {
    hiding: all.hiddenShare,
    seeking: all.seenShare,
    cover: all.coverShare,
    generalization: rooms.length ? Math.min(...rooms.map((r) => r.winRate)) : 0,
  };
  const w = HS_WEIGHTS;
  const score = 100 * (w.winRate * all.winRate + w.hiding * radar.hiding + w.seeking * radar.seeking + w.cover * radar.cover + w.generalization * radar.generalization);
  return { radar, score };
}

/** One opponent's or one room's own 0 to 100 score: the composite without the cross-room part. */
export function partScore(s: GameSummary): number {
  const w = HS_WEIGHTS;
  const total = w.winRate + w.hiding + w.seeking + w.cover;
  return (100 * (w.winRate * s.winRate + w.hiding * s.hiddenShare + w.seeking * s.seenShare + w.cover * s.coverShare)) / total;
}
