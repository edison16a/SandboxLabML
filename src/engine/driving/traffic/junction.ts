import { axisOf } from '../signals/plan';
import type { Fleet } from './fleet';

/** How far down the oncoming lane a left turner looks for traffic, m, and the seconds a left turn takes to clear it. */
const ONCOMING_LOOK = 45;
const LEFT_CLEAR_TIME = 4.5;
/** A car waits at the line unless the lane it turns into has this much room past a car's length, m. */
const EXIT_ROOM = 2;
/** A slow queue at the exit means the box would fill: below this speed, m/s. */
const QUEUE_SPEED = 3;

/** How far an oncoming car at speed v can be and still reach the junction before a left turn clears it, m. */
function oncomingReach(v: number): number {
  return Math.max(ONCOMING_LOOK, v * LEFT_CLEAR_TIME);
}

/**
 * No oncoming car close enough to cut across: a left turner may go. Looks
 * down the oncoming lane and on past it, onto the turns feeding it from the
 * junction behind, since a short block can hide a fast car.
 */
export function oncomingClear(f: Fleet, lane: number): boolean {
  const o = f.oncoming[lane];
  if (o < 0) return true;
  const elements = f.city.elements;
  const len = elements[o].path.length;
  for (let j = f.head[o]; j >= 0; j = f.link[j]) {
    const d = len - f.s[j];
    if (d < oncomingReach(f.v[j]) && elements[f.nxt[j]].turn !== -1 && (f.v[j] > 0.5 || d < 10)) return false;
  }
  const feeding = f.intoLane[o];
  for (let k = 0; k < feeding.length; k++) {
    const c = feeding[k];
    for (let j = f.head[c]; j >= 0; j = f.link[j]) {
      const d = len + elements[c].path.length - f.s[j];
      if (d < oncomingReach(f.v[j]) && elements[f.nxt2[j]].turn !== -1) return false;
    }
  }
  const next = elements[o].next;
  for (let k = 0; k < next.length; k++) if (elements[next[k]].turn !== -1 && f.head[next[k]] >= 0) return false;
  return true;
}

/** No car from the crossing street is still inside the intersection. */
export function boxClear(f: Fleet, node: number, axis: number): boolean {
  const list = f.nodeConnectors[node];
  for (let k = 0; k < list.length; k++) if (f.head[list[k]] >= 0 && axisOf(f.city.elements[list[k]].dir) !== axis) return false;
  return true;
}

/**
 * True while a car coming the other way is turning left across this lane's
 * path. It went first, so a car going straight or right waits at the line
 * rather than drive into its side.
 */
export function leftTurnAcross(f: Fleet, lane: number): boolean {
  const o = f.oncoming[lane];
  if (o < 0) return false;
  const next = f.city.elements[o].next;
  for (let k = 0; k < next.length; k++) if (f.city.elements[next[k]].turn === -1 && f.head[next[k]] >= 0) return true;
  return false;
}

/**
 * True when the lane a turn leads into has room for a car of length `len`:
 * the last car on it is far enough in, or still moving well. Without room
 * a car would stop inside the junction and block everyone crossing it.
 */
export function exitHasRoom(f: Fleet, lane: number, len: number): boolean {
  let tail = -1;
  for (let j = f.head[lane]; j >= 0; j = f.link[j]) if (tail < 0 || f.s[j] < f.s[tail]) tail = j;
  if (tail < 0) return true;
  return f.s[tail] - f.len[tail] / 2 > len + EXIT_ROOM || f.v[tail] > QUEUE_SPEED;
}
