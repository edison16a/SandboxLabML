import type { NavAgent } from '../agent';
import type { Course } from '../course/build';
import { sampleFlow } from '../course/fieldSample';
import type { NavigationParams } from '../params';
import { findHazard, moverZones, zoneAt, type MoverHazard } from './hazard';
import { escapeZone } from './escape';
import { createMemory, type NavigatorMemory } from './memory';
import { laneEntry, lanesOf, lineClear, standsClear, turnDelay, type ZoneLanes } from './lanes';
import { leavesSafely } from './runOn';
import { Trajectory } from './trajectory';

/** Where it lines up to wait, m back from a lane's entry: about 1.5 m from a gate's wall, with room to get up to speed. */
const STAGE = 0.7;
/** Waits tried when picking where to line up, s. */
const WAIT_STEP = 0.2;
const WAIT_MAX = 3.6;
/** Ticks between fresh picks of where to line up, so the pick holds while it walks there. */
const REPICK = 6;
/** Longest turn the agent may still be making as it sets off across a lane, s. */
const MAX_TURN = 0.05;
/** Depth into a mover zone, m, past which the agent is caught inside it rather than waiting on its rim. The rim is the clearance kept round the mover, so a mover never reaches it. */
const RIM = 0.08;
/** Cosine of the steepest slant at which it may run into a lane that a mover reaches. */
const SQUARE = Math.cos(0.45);
/** How much sooner another lane must open before the agent moves over to it, s. */
const SWITCH = 0.6;
/** Cost of a lane per m it lies off the path's own line, in seconds of waiting. */
const OFF_LINE = 0.25;

/** What the planner tells the navigator: how hard to move (-1 to 1), and a unit direction to head in. */
export interface CrossingOrder {
  move: number;
  hx: number;
  hz: number;
}

const hazard: MoverHazard = { mover: -1, inside: false, ex: 0, ez: 0, dx: 1, dz: 0, distance: 0 };
const lanes: ZoneLanes = { count: 0, first: 0, step: 0, ux: 0, uz: 1, cx: 1, cz: 0, cu: 0, hc: 0, depth: 0 };
const go = new Trajectory();
const entry = { x: 0, z: 0 };
const flow = { x: 0, z: 0 };
const scratchMemory = createMemory();

export function head(out: CrossingOrder, move: number, x: number, z: number): void {
  const len = Math.hypot(x, z);
  out.move = move;
  out.hx = len > 1e-6 ? x / len : 1;
  out.hz = len > 1e-6 ? z / len : 0;
}

/**
 * Plans the way past the movers just ahead, or returns false when there
 * are none and the path hint can be followed. Outside a mover's zone (all
 * the floor it can ever reach) the agent is safe whatever the mover does,
 * so it walks up to the zone, picks one of the zone's lanes (the one the
 * path runs along first, then out to each side, never into a wall or
 * spikes) and dashes only when that lane stays clear of every mover for
 * the whole crossing. Until one does, it lines up just short of the zone
 * in front of the lane that opens soonest. Caught inside a zone, it goes
 * on, stands or backs out (see escapeZone).
 */
export function planCrossing(a: NavAgent, course: Course, params: NavigationParams, pace: number, memory: NavigatorMemory | null, out: CrossingOrder): boolean {
  if (course.movers.length === 0) return false;
  const mem = memory ?? scratchMemory;
  if (a.time < mem.time) Object.assign(mem, createMemory());
  mem.time = a.time;
  const r = params.agent.radius;
  const zones = moverZones(course, r);
  // Only well inside a zone is it caught; on its rim it still plans like one outside, which can wait there safely.
  const inZone = zoneAt(zones, a.x, a.z, RIM);
  if (inZone >= 0) return escapeZone(a, course, params, zones, inZone, mem, out);
  if (!findHazard(course, zones, a.x, a.z, hazard)) {
    mem.zone = mem.stageMover = -1;
    return false;
  }
  const k = hazard.mover;
  lanesOf(course, zones, k, hazard, lanes);
  const top = params.agent.maxSpeed * pace;
  // The path's own lane, then out to each side of it in turn.
  const home = Math.round((lanes.cu - lanes.first) / lanes.step);
  for (let n = 0; n < lanes.count * 2; n++) {
    const j = home + (n % 2 === 0 ? n / 2 : -(n + 1) / 2);
    if (j < 0 || j >= lanes.count) continue;
    laneEntry(lanes, zones, k, j, entry);
    // Already level with the zone (beside it): the lane starts where it stands, not back at the near face.
    const into = Math.max(0, (a.x - entry.x) * lanes.cx + (a.z - entry.z) * lanes.cz);
    entry.x += lanes.cx * into;
    entry.z += lanes.cz * into;
    if (!standsClear(course, entry.x, entry.z, r)) continue;
    const delay = turnDelay(a, entry.x + lanes.cx * 0.5 - a.x, entry.z + lanes.cz * 0.5 - a.z, params.agent.turnRate);
    go.build(a.x, a.z, entry.x, entry.z, lanes.cx, lanes.cz, lanes.depth - into, a.speed, delay + Math.max(0, -a.speed) / params.agent.accel, top, params.agent.accel);
    const exitX = entry.x + lanes.cx * (lanes.depth - into);
    const exitZ = entry.z + lanes.cz * (lanes.depth - into);
    const room = go.clearOfSolids(course, r) && leavesSafely(course, params, exitX, exitZ, lanes.cx, lanes.cz, top) ? go.moverRoom(course, zones, r, a.time, 0, 0) : -1;
    // A lane no mover reaches can be taken any way. One a mover reaches is only taken facing it and square
    // on, at full stride: turning or running in slanted would not keep to the timing.
    const seg = Math.hypot(entry.x - a.x, entry.z - a.z);
    const square = seg < 0.3 || ((entry.x - a.x) * lanes.cx + (entry.z - a.z) * lanes.cz) / seg > SQUARE;
    if (room === Infinity || (room >= 0 && square && delay <= MAX_TURN)) {
      // Clear for the whole crossing: go now, aiming a little into the lane so it crosses square.
      mem.zone = k;
      mem.lane = j;
      mem.cx = lanes.cx;
      mem.cz = lanes.cz;
      head(out, pace, entry.x + lanes.cx * 0.5 - a.x, entry.z + lanes.cz * 0.5 - a.z);
      return true;
    }
  }
  // Waiting: no lane is promised yet.
  mem.zone = -1;
  if (mem.stageMover !== k || mem.nextPick <= 0) {
    mem.stageLane = pickStage(a, course, zones, k, home, mem.stageMover === k ? mem.stageLane : -1, top, params, r);
    mem.stageMover = k;
    // Agents differ in how soon they look again, so a crowd arriving together does not all plan on one tick.
    mem.nextPick = REPICK + (a.index % REPICK);
  }
  mem.nextPick--;
  // Line up in front of the chosen lane, short of the zone, and face across it.
  laneEntry(lanes, zones, k, Math.min(lanes.count - 1, Math.max(0, mem.stageLane)), entry);
  const sx = entry.x - lanes.cx * STAGE;
  const sz = entry.z - lanes.cz * STAGE;
  const gap = Math.hypot(sx - a.x, sz - a.z);
  if (gap < 0.15) {
    head(out, 0, lanes.cx, lanes.cz);
    return true;
  }
  // Straight to the waiting spot when nothing is in the way, else along the path hint until it is.
  const direct = lineClear(course, a.x, a.z, sx, sz, r);
  const fx = Math.cos(a.yaw);
  const fz = -Math.sin(a.yaw);
  if (direct && (sx - a.x) * fx + (sz - a.z) * fz < -0.6 * gap) {
    // The spot is behind it (it came in too far): back up to it still facing the zone, rather than turn round.
    head(out, -Math.min(1, gap / 0.8 + 0.1), a.x - sx, a.z - sz);
    return true;
  }
  if (direct) head(out, pace * Math.min(1, gap / 1.5 + 0.1), sx - a.x, sz - a.z);
  else {
    sampleFlow(course.field, a.x, a.z, flow);
    head(out, pace * Math.min(1, Math.max(0.2, (hazard.distance - STAGE) / 1.5)), flow.x, flow.z);
  }
  if (zoneAt(zones, a.x + out.hx * 0.3, a.z + out.hz * 0.3) >= 0) head(out, 0, lanes.cx, lanes.cz);
  return true;
}

/**
 * The lane to line up at: the one whose dash, from its waiting spot, opens
 * soonest, counting the walk there and a little for lying off the path. It
 * keeps `current` unless another is clearly better, so it does not shuffle
 * from side to side while it waits.
 */
function pickStage(a: NavAgent, course: Course, zones: Float64Array, k: number, home: number, current: number, top: number, params: NavigationParams, r: number): number {
  let best = home;
  let bestCost = Infinity;
  let currentCost = Infinity;
  for (let j = 0; j < lanes.count; j++) {
    const cost = laneCost(a, course, zones, k, j, home, top, params, r, j === current ? Infinity : bestCost);
    if (j === current) currentCost = cost;
    if (cost < bestCost) {
      bestCost = cost;
      best = j;
    }
  }
  return currentCost < bestCost + SWITCH ? current : best;
}

/** Seconds until lane j could be crossed from its waiting spot, plus its walk and off line costs, or Infinity. Gives up past `bound`. */
function laneCost(a: NavAgent, course: Course, zones: Float64Array, k: number, j: number, home: number, top: number, params: NavigationParams, r: number, bound: number): number {
  laneEntry(lanes, zones, k, j, entry);
  const sx = entry.x - lanes.cx * STAGE;
  const sz = entry.z - lanes.cz * STAGE;
  if (!standsClear(course, entry.x, entry.z, r) || !standsClear(course, sx, sz, r)) return Infinity;
  // The walk there: turn to the spot, walk, then turn to face across the lane.
  const d = Math.hypot(sx - a.x, sz - a.z);
  const back = d > 0.15 ? Math.max(0, Math.acos(Math.max(-1, Math.min(1, ((sx - a.x) * lanes.cx + (sz - a.z) * lanes.cz) / d))) - 0.45) / params.agent.turnRate : 0;
  const walk = d / top + (d > 0.15 ? turnDelay(a, sx - a.x, sz - a.z, params.agent.turnRate) : turnDelay(a, lanes.cx, lanes.cz, params.agent.turnRate)) + back + 0.2;
  const off = Math.abs(j - home) * lanes.step * OFF_LINE;
  if (walk + off >= bound) return Infinity;
  go.build(sx, sz, entry.x, entry.z, lanes.cx, lanes.cz, lanes.depth, 0, 0, top, params.agent.accel);
  if (!go.clearOfSolids(course, r) || !leavesSafely(course, params, entry.x + lanes.cx * lanes.depth, entry.z + lanes.cz * lanes.depth, lanes.cx, lanes.cz, top)) return Infinity;
  for (let w = walk; w <= WAIT_MAX && w + off < bound; w += WAIT_STEP) if (go.clearOfMovers(course, zones, r, a.time, w)) return w + off;
  return Infinity;
}
