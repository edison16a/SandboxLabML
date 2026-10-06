import { HIDESEEK_LAYOUT_IDS } from '../layouts/presets';
import type { HideSeekLayoutId } from '../layouts/types';
import { checkOpponents } from './setups';
import type { HideSeekDirective, HideSeekOpponents, ResolvedTrainerOptions } from './types';

/** Longest prep a directive may ask for, s. Leaves room to seek in a 30 s match. */
export const MAX_PREP_SECONDS = 20;
/** Largest hall of fame a directive may ask for. */
export const MAX_HALL_OF_FAME = 100;

const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/**
 * Turns whatever a script handed back into a directive the trainer can
 * trust. Scripts are checked before they run, but this is the boundary
 * between the language and the engine, so anything malformed is dropped
 * here instead of reaching the schedule.
 */
export function readHideSeekDirective(raw: unknown): HideSeekDirective {
  if (typeof raw !== 'object' || raw === null) return {};
  const r = raw as Record<string, unknown>;
  const out: HideSeekDirective = {};
  if (isNumber(r.prepSeconds)) out.prepSeconds = clamp(r.prepSeconds, 0, MAX_PREP_SECONDS);
  if (isNumber(r.hallOfFameSize)) out.hallOfFameSize = Math.round(clamp(r.hallOfFameSize, 1, MAX_HALL_OF_FAME));
  if (typeof r.mixLayouts === 'boolean') out.mixLayouts = r.mixLayouts;
  if (typeof r.sharedSeeds === 'boolean') out.sharedSeeds = r.sharedSeeds;
  if (Array.isArray(r.layouts)) {
    const known = r.layouts.filter((id): id is HideSeekLayoutId => (HIDESEEK_LAYOUT_IDS as readonly unknown[]).includes(id));
    if (known.length > 0) out.layouts = known;
  }
  if (typeof r.opponents === 'object' && r.opponents !== null) {
    const o = r.opponents as Record<string, unknown>;
    const mix: Partial<HideSeekOpponents> = {};
    for (const key of ['current', 'hallOfFame', 'scripted'] as const) if (isNumber(o[key])) mix[key] = Math.round(clamp(o[key], 0, 6));
    if (Object.keys(mix).length > 0) out.opponents = mix;
  }
  return out;
}

/**
 * Applies a directive to the live rules in place. Fields it leaves out
 * keep their value. An opponent mix that cannot be played (no rounds at
 * all, or too many) is ignored as a whole, so a bad script line never
 * stops a run.
 */
export function applyHideSeekDirective(o: ResolvedTrainerOptions, d: HideSeekDirective): void {
  if (d.prepSeconds !== undefined) o.prepSeconds = d.prepSeconds;
  if (d.hallOfFameSize !== undefined) o.hallOfFameSize = d.hallOfFameSize;
  if (d.layouts && d.layouts.length > 0) o.layouts = [...d.layouts];
  if (d.mixLayouts !== undefined) o.mixLayouts = d.mixLayouts;
  if (d.sharedSeeds !== undefined) o.sharedSeeds = d.sharedSeeds;
  if (d.opponents) {
    try {
      o.opponents = checkOpponents({ ...o.opponents, ...d.opponents });
      o.rounds = o.opponents.current + o.opponents.hallOfFame + o.opponents.scripted;
    } catch {
      // Unplayable mix: keep the current one.
    }
  }
}
