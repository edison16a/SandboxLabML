import type { Remote } from 'comlink';
import type { MatchResult, MatchSpec } from '@/engine/hideseek/match/types';
import type { SimApi } from '../sim/sim.worker';
import type { StreamPart } from '../shared/protocol';

/** Matches per batch for headless rounds. Big enough to amortize messaging, small enough to balance the load. */
export const HEADLESS_BATCH = 8;

/**
 * Plays a round headless across the sim workers. Batches are handed out as
 * workers free up, so a slow worker never holds the round back, and the
 * results come back in spec order whatever order the batches finish in.
 */
export async function playHeadless(sims: Remote<SimApi>[], specs: MatchSpec[], scriptSource: string | null): Promise<MatchResult[]> {
  const results: MatchResult[] = new Array(specs.length);
  let next = 0;
  await Promise.all(
    sims.map(async (sim) => {
      while (next < specs.length) {
        const from = next;
        next = Math.min(specs.length, next + HEADLESS_BATCH);
        const out = await sim.evaluateHideSeek(specs.slice(from, next), scriptSource);
        out.forEach((r, k) => (results[from + k] = r));
      }
    }),
  );
  return results;
}

/** One sim worker's share of a live round. */
export interface LiveSplit {
  sim: number;
  part: StreamPart;
  specs: MatchSpec[];
}

/**
 * Splits a live round into consecutive runs of matches, one per worker, so
 * each worker streams a contiguous slice and the main thread can merge the
 * slices by their first index.
 */
export function splitLiveRound(specs: MatchSpec[], workers: number, epoch: number): LiveSplit[] {
  const chunk = Math.ceil(specs.length / Math.max(1, workers));
  const out: LiveSplit[] = [];
  for (let k = 0; k < workers && k * chunk < specs.length; k++) {
    const first = k * chunk;
    out.push({ sim: k, part: { first, total: specs.length, epoch }, specs: specs.slice(first, first + chunk) });
  }
  return out;
}
