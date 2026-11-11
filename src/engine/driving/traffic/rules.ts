import { ELEMENT_LANE } from '../city/types';
import { axisOf, LIGHT_RED, LIGHT_YELLOW, lightState } from '../signals/plan';
import type { Fleet } from './fleet';
import { findLead, type Lead } from './leads';

/** Intelligent driver model constants: comfortable acceleration and braking, standstill gap, time headway. */
export const IDM = { accel: 1.8, brake: 2.6, gap: 2.0, headway: 1.25 };
/** Braking a driver accepts to stop for a yellow, m/s^2. Any harder and they go through. */
const YELLOW_BRAKE = 3.5;
/** The firmest braking a driver uses to stop for someone stepping onto a crossing, m/s^2. */
const FIRM_BRAKE = 6;
/** Gentle braking used to slow down for a turn ahead, m/s^2. */
const TURN_BRAKE = 1.6;
/** How far before a line a car comes to rest, m. */
const STOP_MARGIN = 0.8;
/** How far down the oncoming lane a left turner looks for traffic, m. */
const ONCOMING_LOOK = 45;

/** Reused result of the lead search. */
const lead: Lead = { gap: Infinity, dv: 0 };

/** What else is in the city that cars must respect this tick. */
export interface TrafficContext {
  time: number;
  signalsOn: boolean;
  signalOffsets: Float64Array;
  /** Per crossing: 1 while someone is on it or stepping onto it. */
  busy: Uint8Array;
  /** People crossing away from any crossing, which every driver watches for. */
  jayX: Float64Array;
  jayY: Float64Array;
  jayCount: number;
}

/** IDM acceleration toward `v0` behind something `gap` meters ahead closing at `dv` m/s. */
function idm(v: number, v0: number, gap: number, dv: number): number {
  const free = 1 - (v / Math.max(v0, 0.1)) ** 4;
  if (!(gap < Infinity)) return IDM.accel * free;
  const want = IDM.gap + Math.max(0, v * IDM.headway + (v * dv) / (2 * Math.sqrt(IDM.accel * IDM.brake)));
  const g = Math.max(gap, 0.05);
  return IDM.accel * (free - (want / g) ** 2);
}

/** Gap to a standing obstacle `dist` meters ahead of the car's front, so the car stops `margin` short of it. */
function standing(dist: number, margin: number): number {
  return dist + IDM.gap - margin;
}

/** No oncoming car close enough to cut across: a left turner may go. */
function oncomingClear(f: Fleet, lane: number): boolean {
  const o = f.oncoming[lane];
  if (o < 0) return true;
  const elements = f.city.elements;
  const len = elements[o].path.length;
  for (let j = f.head[o]; j >= 0; j = f.link[j]) {
    const d = len - f.s[j];
    if (d < ONCOMING_LOOK && elements[f.nxt[j]].turn !== -1 && (f.v[j] > 0.5 || d < 10)) return false;
  }
  const next = elements[o].next;
  for (let k = 0; k < next.length; k++) if (elements[next[k]].turn !== -1 && f.head[next[k]] >= 0) return false;
  return true;
}

/** No car from the crossing street is still inside the intersection. */
function boxClear(f: Fleet, node: number, axis: number): boolean {
  const list = f.nodeConnectors[node];
  for (let k = 0; k < list.length; k++) if (f.head[list[k]] >= 0 && axisOf(f.city.elements[list[k]].dir) !== axis) return false;
  return true;
}

/**
 * How hard car i wants to accelerate this tick. It follows the car ahead
 * (IDM), eases off for turns, and treats a red light, a busy crossing, a
 * person in the road, an oncoming car (when turning left) or a car still
 * crossing the intersection as a standing obstacle at the line.
 */
export function trafficAccel(f: Fleet, i: number, ctx: TrafficContext): number {
  const elements = f.city.elements;
  const e = elements[f.el[i]];
  const s = f.s[i];
  const v = f.v[i];
  const half = f.len[i] / 2;
  const toEnd = e.path.length - s;
  const { gap, dv } = findLead(f, i, lead);
  let a = idm(v, f.v0[i], gap, dv);
  let v0 = f.v0[i];
  let stop = Infinity;
  if (e.kind === ELEMENT_LANE) {
    const turn = elements[f.nxt[i]];
    const front = toEnd - half;
    v0 = Math.min(v0, Math.sqrt(f.turnSpeed[turn.id] ** 2 + 2 * TURN_BRAKE * Math.max(0, front)));
    const node = f.city.nodes[e.to];
    if (e.stopLine) {
      const axis = axisOf(e.dir);
      const light = lightState(ctx.time, ctx.signalOffsets[node.signal], axis, ctx.signalsOn);
      // A car crawling or standing at the line can always stop, so it never starts a turn on yellow.
      const canStop = v < 2 || front > (v * v) / (2 * YELLOW_BRAKE) + 1;
      if (light === LIGHT_RED || (light === LIGHT_YELLOW && canStop)) stop = Math.min(stop, standing(front, STOP_MARGIN));
      else if ((turn.turn === -1 && !oncomingClear(f, e.id)) || (front < 14 && !boxClear(f, node.id, axis))) stop = Math.min(stop, standing(front, STOP_MARGIN));
    }
    for (let k = 0; k < turn.crossings.length; k++) {
      const c = turn.crossings[k];
      if (!ctx.busy[c.crosswalk]) continue;
      // A left turner waits at the line, not in the middle of the junction where oncoming cars pass.
      stop = Math.min(stop, turn.turn === -1 && e.stopLine ? standing(front, STOP_MARGIN) : standing(front + c.s0, 1.2));
    }
  } else {
    v0 = Math.min(v0, f.turnSpeed[e.id]);
    for (let k = 0; k < e.crossings.length; k++) {
      const c = e.crossings[k];
      const d = c.s0 - s - half;
      // Stop for someone new on the crossing if there is still room to; past that, clear it rather than stop on it.
      if (ctx.busy[c.crosswalk] && d > 0.5 && (v * v) / (2 * FIRM_BRAKE) < d) stop = Math.min(stop, standing(d, 1.2));
    }
  }
  for (let k = 0; k < ctx.jayCount; k++) {
    const rx = ctx.jayX[k] - f.px[i];
    const ry = ctx.jayY[k] - f.py[i];
    const fwd = rx * Math.cos(f.ph[i]) + ry * Math.sin(f.ph[i]);
    const side = -rx * Math.sin(f.ph[i]) + ry * Math.cos(f.ph[i]);
    if (fwd > half && fwd < 35 && Math.abs(side) < 2.6) stop = Math.min(stop, standing(fwd - half, 1.8));
  }
  if (v0 < f.v0[i]) a = Math.min(a, idm(v, v0, gap, dv));
  if (stop < Infinity) a = Math.min(a, idm(v, v0, stop, v));
  return Math.max(-8, Math.min(IDM.accel, a));
}
