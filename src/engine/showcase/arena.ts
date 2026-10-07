import type { ReferenceChampion } from '../bench/types';
import { mixSeed } from '../core/rng';
import type { HideSeekLayoutId } from '../hideseek/layouts/types';
import { hideSeekBrainInputs } from '../hideseek/sensing/inputSchema';

/** Brains with up to this many inputs still read at a glance as a graph in the hero's brain panel. */
export const READABLE_INPUTS = 24;

/**
 * The reference pair the landing page shows: the best rated pair whose
 * brains are small enough to read at a glance, else simply the best rated
 * pair. The reference file is regenerated as the presets change, so the
 * pick follows the ratings rather than naming a tier.
 */
export function pickShowcasePair(champions: readonly ReferenceChampion[]): ReferenceChampion | null {
  const byRating = [...champions].sort((a, b) => b.rating - a.rating);
  const readable = (c: ReferenceChampion) => hideSeekBrainInputs(c.hider.inputs) <= READABLE_INPUTS && hideSeekBrainInputs(c.seeker.inputs) <= READABLE_INPUTS;
  return byRating.find(readable) ?? byRating[0] ?? null;
}

/** Players per team in a hero match. */
export const SHOWCASE_PLAYERS = 2;

/** The rooms hero matches take turns in. Both have walls to hide behind and a ramp to beat them with. */
export const SHOWCASE_ROOMS: readonly HideSeekLayoutId[] = ['shelter', 'corridor'];

/** One hero match: where it is played and the seed that places everyone. */
export interface ShowcaseMatch {
  room: HideSeekLayoutId;
  seed: number;
}

/** The nth match the hero plays. Every match starts from new spawn spots, and rooms take turns. */
export function showcaseMatch(n: number): ShowcaseMatch {
  return { room: SHOWCASE_ROOMS[n % SHOWCASE_ROOMS.length], seed: mixSeed(0x4e70, n) };
}
