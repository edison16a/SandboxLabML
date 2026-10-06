/** Rating points for ten to one odds, as in chess. */
export const ELO_SCALE = 400;

/** The mean of the reference ratings. Ratings only mean something next to the references. */
export const ELO_ANCHOR = 1500;

/** Expected share of points for a player rated `rating` against one rated `opponent`. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / ELO_SCALE));
}

/** A player's results against one opponent: points won (a draw is half) out of `games`. */
export interface EloRecord {
  opponent: number;
  points: number;
  games: number;
}

/**
 * The rating whose expected points against these opponents equal the
 * points actually won, which is the maximum likelihood rating when the
 * opponents' ratings are fixed. One virtual draw per opponent is added, so
 * a clean sweep gives a high but finite rating instead of infinity.
 * Expected points rise with the rating, so bisection finds it exactly.
 */
export function performanceRating(records: readonly EloRecord[]): number {
  if (records.length === 0) return ELO_ANCHOR;
  const actual = records.reduce((s, r) => s + r.points + 0.5, 0);
  const ratings = records.map((r) => r.opponent);
  let lo = Math.min(...ratings) - 8 * ELO_SCALE;
  let hi = Math.max(...ratings) + 8 * ELO_SCALE;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    const expected = records.reduce((s, r) => s + (r.games + 1) * expectedScore(mid, r.opponent), 0);
    if (expected < actual) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** One pairing of a round robin: player `a` won `points` of `games` against player `b`. */
export interface Pairing {
  a: number;
  b: number;
  points: number;
  games: number;
}

/**
 * Ratings for a round robin, with their mean pinned at ELO_ANCHOR. Each
 * pass sets every player to its performance rating against the others'
 * current ratings, which converges to the maximum likelihood fit (with the
 * same virtual draw per pairing as performanceRating). So a player rated
 * here and then measured with performanceRating against the others gets
 * its own rating back.
 */
export function fitRatings(players: number, pairings: readonly Pairing[], passes = 500): number[] {
  let ratings = new Array<number>(players).fill(ELO_ANCHOR);
  for (let pass = 0; pass < passes; pass++) {
    const next = ratings.map((_, i) => {
      const records: EloRecord[] = [];
      for (const p of pairings) {
        if (p.a === i) records.push({ opponent: ratings[p.b], points: p.points, games: p.games });
        else if (p.b === i) records.push({ opponent: ratings[p.a], points: p.games - p.points, games: p.games });
      }
      return records.length ? performanceRating(records) : ELO_ANCHOR;
    });
    const shift = ELO_ANCHOR - next.reduce((s, r) => s + r, 0) / players;
    ratings = next.map((r) => r + shift);
  }
  return ratings;
}
