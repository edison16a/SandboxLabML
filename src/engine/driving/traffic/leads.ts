import { ELEMENT_LANE } from '../city/types';
import type { Fleet } from './fleet';

/** How far before a merge a car starts to give way to one that will get there first, m. */
const MERGE_LOOK = 30;
/** How far short of a merge a car waits for one with the right of way, m. */
const HOLD_SHORT = 3;
/** Past this distance a car ahead no longer matters, m. */
const LOOK = 80;

/** The car to follow: bumper to bumper gap, m, and how fast we close on it, m/s. Infinity when the road is clear. */
export interface Lead {
  gap: number;
  dv: number;
}

/** The closest car ahead found so far in this search, kept at module level so the hot loop allocates nothing. */
let best = Infinity;
let lead = -1;

function take(j: number, ahead: number): void {
  if (ahead > 0 && ahead < best) {
    best = ahead;
    lead = j;
  }
}

/**
 * Finds the car that car i must follow. First the cars along its own
 * planned chain (this element, the next, the one after). Then two kinds of
 * cars on other connectors that share road with it: a car that just turned
 * off the same lane and is not yet clear of the shared first stretch (so a
 * car going straight does not drive through a slow right turner, see
 * Fleet.shared), and a car that will
 * reach the lane it merges into first (so two turns into one lane take
 * turns). Each counts as a car ahead at the distance it is in front. A left
 * turner in the junction has the right of way at a merge: a car turning
 * into the same lane waits short of the merge instead.
 */
export function findLead(f: Fleet, i: number, out: Lead): Lead {
  const elements = f.city.elements;
  const s = f.s[i];
  const half = f.len[i] / 2;
  best = Infinity;
  lead = -1;
  // Along its own chain: on this element, else on the next, else the one after.
  let offset = -s;
  for (let k = 0; k < 3 && lead < 0 && offset <= LOOK; k++) {
    const el = k === 0 ? f.el[i] : k === 1 ? f.nxt[i] : f.nxt2[i];
    for (let j = f.head[el]; j >= 0; j = f.link[j]) if (j !== i) take(j, offset + f.s[j]);
    offset += elements[el].path.length;
  }
  const e = elements[f.el[i]];
  const onLane = e.kind === ELEMENT_LANE;
  const turn = onLane ? f.nxt[i] : e.id;
  // Cars still in the shared first stretch of another turn out of the same lane.
  const siblings = elements[onLane ? e.id : e.fromLane].next;
  const before = onLane ? e.path.length - s : -s;
  if (onLane || s - half < f.shared[e.id]) {
    for (let k = 0; k < siblings.length; k++) {
      const c = siblings[k];
      if (c === turn) continue;
      for (let j = f.head[c]; j >= 0; j = f.link[j]) if (f.s[j] - f.len[j] / 2 < f.shared[c]) take(j, before + f.s[j]);
    }
  }
  // Cars on other turns into the same lane that will get there first.
  const mine = elements[turn].turn;
  const toMerge = (onLane ? e.path.length - s : -s) + elements[turn].path.length;
  let hold = Infinity;
  // A left turner already in the junction never stops for a merge: it would stand in the oncoming cars' way.
  if (toMerge < MERGE_LOOK && (onLane || mine !== -1)) {
    const into = f.intoLane[elements[turn].toLane];
    for (let k = 0; k < into.length; k++) {
      if (into[k] === turn) continue;
      const len = elements[into[k]].path.length;
      const theirs = elements[into[k]].turn;
      for (let j = f.head[into[k]]; j >= 0; j = f.link[j]) {
        const left = len - f.s[j];
        if (left < toMerge || (left === toMerge && j < i)) take(j, toMerge - left + 1e-3);
        // A car already turning waits short of the merge for a left turner on its way, unless its own nose is past that point.
        else if (!onLane && theirs === -1 && toMerge - half > 0) hold = Math.min(hold, toMerge - half - HOLD_SHORT);
      }
    }
  }
  out.gap = lead >= 0 ? best - half - f.len[lead] / 2 : Infinity;
  out.dv = lead >= 0 ? f.v[i] - f.v[lead] : 0;
  if (hold < out.gap) {
    out.gap = hold;
    out.dv = f.v[i];
  }
  return out;
}
