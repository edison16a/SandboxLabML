import { DIR_X, DIR_Y, STOP_LINE } from '../city/dimensions';
import type { City } from '../city/types';
import { projection, type Path } from '../geometry/path';
import { crossingBusy } from '../sensors/crossings';
import { WALK_DONT } from '../signals/plan';
import { FLAG_LEFT, type WorldState } from '../world/state';

const proj = projection();
/** How hard traffic brakes for a yellow, m/s^2: a cross car that could not stop at that rate is coming through. */
const TRAFFIC_YELLOW = 3.5;
/** How far before its line a traffic car shows it will turn, m: its indicator comes on 30 m before the lane ends. */
const INDICATED = 34;
/** A slow queue past the junction means the box would fill: below this speed, m/s. */
const QUEUE_SPEED = 3;

/**
 * True when an oncoming car is turning left across our path at `node`, or
 * is at its line and free to go. Traffic cannot see the SUV, so a left
 * turner only waits for other traffic: with none coming our way it turns
 * now, and the SUV must let it. Its indicator says it will turn.
 */
export function oncomingLeftTurn(city: City, world: WorldState, node: number, dir: number): boolean {
  const n = city.nodes[node];
  const fx = DIR_X[dir];
  const fy = DIR_Y[dir];
  for (let i = 0; i < world.carCount; i++) {
    if (!(world.carFlags[i] & FLAG_LEFT)) continue;
    const dx = world.carX[i] - n.x;
    const dy = world.carY[i] - n.y;
    const facing = Math.cos(world.carHeading[i]) * fx + Math.sin(world.carHeading[i]) * fy;
    // Already turning inside the junction, from any side but ours from behind.
    if (Math.abs(dx) < STOP_LINE && Math.abs(dy) < STOP_LINE && facing < 0.5 && world.carSpeed[i] > 0.3) return true;
    const along = dx * fx + dy * fy;
    const across = -dx * fy + dy * fx;
    // Rolling up to its line on the far side: its indicator shows over the last stretch of its lane.
    if (facing > -0.8 || along < STOP_LINE - 1 || along > STOP_LINE + INDICATED || across < 0 || across > 3.5) continue;
    if (world.carSpeed[i] > 1 || !trafficComingWithUs(city, world, node, dir)) return true;
  }
  return false;
}

/** True when a traffic car is coming toward `node` in direction `dir` that an oncoming left turner must wait for. */
function trafficComingWithUs(city: City, world: WorldState, node: number, dir: number): boolean {
  const n = city.nodes[node];
  const fx = DIR_X[dir];
  const fy = DIR_Y[dir];
  for (let i = 0; i < world.carCount; i++) {
    if (world.carFlags[i] & FLAG_LEFT) continue;
    const dx = world.carX[i] - n.x;
    const dy = world.carY[i] - n.y;
    const along = dx * fx + dy * fy;
    const across = -dx * fy + dy * fx;
    const facing = Math.cos(world.carHeading[i]) * fx + Math.sin(world.carHeading[i]) * fy;
    if (facing < 0.7 || across > 0 || across < -3.5 || along > -STOP_LINE + 2) continue;
    const d = -along - STOP_LINE;
    if (d < Math.max(45, world.carSpeed[i] * 4.5) && (world.carSpeed[i] > 0.5 || d < 10)) return true;
  }
  return false;
}

/**
 * True while a car from the crossing street is inside the junction, or so
 * close to it and so fast that it cannot stop at its line and will come
 * through (it went on a late yellow).
 */
export function crossTraffic(city: City, world: WorldState, node: number, dir: number): boolean {
  const n = city.nodes[node];
  for (let i = 0; i < world.carCount; i++) {
    const dx = world.carX[i] - n.x;
    const dy = world.carY[i] - n.y;
    const c = Math.cos(world.carHeading[i]);
    const crossing = dir % 2 === 0 ? Math.abs(c) < 0.5 : Math.abs(c) > 0.5;
    if (!crossing) continue;
    if (Math.abs(dx) < STOP_LINE - 2 && Math.abs(dy) < STOP_LINE - 2) return true;
    // Coming in along its street: distance from its front to its stop line.
    const toward = -(dx * Math.cos(world.carHeading[i]) + dy * Math.sin(world.carHeading[i]));
    const offAxis = Math.abs(dx * Math.sin(world.carHeading[i]) - dy * Math.cos(world.carHeading[i]));
    const v = world.carSpeed[i];
    const toLine = toward - STOP_LINE - world.carLength[i] / 2;
    if (offAxis < 3.5 && toLine > -1 && toLine < 25 && v > 1 && toLine < (v * v) / (2 * TRAFFIC_YELLOW)) return true;
  }
  return false;
}

/**
 * True when the lane past the junction is backed up: a car standing or
 * crawling within a car length of where the turn ends (`exitS`, route arc
 * length). Entering then would leave the SUV stuck inside the box.
 */
export function exitBlocked(path: Path, world: WorldState, exitS: number, index: number, room: number): boolean {
  for (let i = 0; i < world.carCount; i++) {
    if (world.carSpeed[i] > QUEUE_SPEED) continue;
    const hint = path.indexAt(exitS, index);
    const dx = world.carX[i] - path.x[hint];
    const dy = world.carY[i] - path.y[hint];
    if (dx * dx + dy * dy > (room + 10) * (room + 10)) continue;
    path.project(world.carX[i], world.carY[i], hint, 30, proj);
    const rear = proj.s - world.carLength[i] / 2;
    if (proj.distance < 4 && Math.abs(proj.lateral) < 2 && rear > exitS - 6 && rear < exitS + room) return true;
  }
  return false;
}

/** People this close to an end of a crossing while its walk signal shows may step out before the turn reaches it, m. */
const ABOUT_TO_CROSS = 10;

/**
 * True when the crossing a turn ends on is clear and likely to stay so:
 * nobody on it or waiting to step out, and nobody near either end while
 * the walk signal shows or flashes. People cannot see the SUV either, so a turn
 * started now must not end up waiting in the junction for them.
 */
export function exitCrossingQuiet(city: City, world: WorldState, turnElement: number): boolean {
  const list = city.elements[turnElement].crossings;
  if (list.length === 0) return true;
  // The exit crossing is the one furthest along the turn.
  let id = list[0].crosswalk;
  let far = list[0].s0;
  for (let k = 1; k < list.length; k++) if (list[k].s0 > far) [id, far] = [list[k].crosswalk, list[k].s0];
  if (crossingBusy(city, world, id)) return false;
  const k = city.crosswalks[id];
  // Late crossers still go on the flashing hand, so only a steady "don't walk" is safe.
  if (world.walks[city.nodes[k.node].signal * 2 + k.walkAxis] === WALK_DONT) return true;
  const r2 = ABOUT_TO_CROSS * ABOUT_TO_CROSS;
  for (let i = 0; i < world.pedCount; i++) {
    const ax = world.pedX[i] - k.ax;
    const ay = world.pedY[i] - k.ay;
    const bx = world.pedX[i] - k.bx;
    const by = world.pedY[i] - k.by;
    if (ax * ax + ay * ay < r2 || bx * bx + by * by < r2) return false;
  }
  return true;
}

