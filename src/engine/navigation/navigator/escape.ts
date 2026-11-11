import type { NavAgent } from '../agent';
import type { Course } from '../course/build';
import { sampleFlow } from '../course/fieldSample';
import type { NavigationParams } from '../params';
import type { CrossingOrder } from './crossing';
import { zoneAt, type MoverHazard } from './hazard';
import { crossingAxis, laneEntry, lanesOf, type ZoneLanes } from './lanes';
import type { NavigatorMemory } from './memory';
import { leavesSafely } from './runOn';
import { Trajectory } from './trajectory';

const ahead = new Trajectory();
const back = new Trajectory();
const still = new Trajectory();
const dir = { x: 0, z: 0 };
const entry = { x: 0, z: 0 };
const probe: MoverHazard = { mover: -1, inside: true, ex: 0, ez: 0, dx: 1, dz: 0, distance: 0 };
const lanes: ZoneLanes = { count: 0, first: 0, step: 0, ux: 0, uz: 1, cx: 1, cz: 0, cu: 0, hc: 0, depth: 0 };

/** How far along (cx, cz) from (x, z) the agent stays inside any mover zone, m. */
function zoneDepth(zones: Float64Array, x: number, z: number, cx: number, cz: number): number {
  let s = 0;
  while (s < 6 && zoneAt(zones, x + cx * s, z + cz * s) >= 0) s += 0.1;
  return s;
}

/**
 * Inside mover zone k: go on along its lane, stand, or back out, whichever
 * keeps most room from the movers. The lane and direction are the ones it
 * set off on (kept in memory), or for one that wandered in, the lane it
 * stands in, square to the mover's slide, so it never dithers inside.
 */
export function escapeZone(a: NavAgent, course: Course, params: NavigationParams, zones: Float64Array, k: number, mem: NavigatorMemory, out: CrossingOrder): boolean {
  const r = params.agent.radius;
  const ag = params.agent;
  if (mem.zone !== k) {
    sampleFlow(course.field, a.x, a.z, dir);
    crossingAxis(course, k, dir.x, dir.z, dir);
    mem.zone = k;
    mem.lane = -1;
    mem.cx = dir.x;
    mem.cz = dir.z;
  }
  probe.dx = mem.cx;
  probe.dz = mem.cz;
  probe.ex = a.x;
  probe.ez = a.z;
  lanesOf(course, zones, k, probe, lanes);
  if (mem.lane < 0 || mem.lane >= lanes.count) mem.lane = Math.max(0, Math.min(lanes.count - 1, Math.round((lanes.cu - lanes.first) / lanes.step)));
  // Ahead: back onto the lane a little further in, then on across and out.
  laneEntry(lanes, zones, k, mem.lane, entry);
  const cx = lanes.cx;
  const cz = lanes.cz;
  const into = Math.max(0, (a.x - entry.x) * cx + (a.z - entry.z) * cz) + 0.4;
  const tx = entry.x + cx * into;
  const tz = entry.z + cz * into;
  const across = Math.max(0.2, lanes.depth - into);
  ahead.build(a.x, a.z, tx, tz, cx, cz, across, a.speed, 0, ag.maxSpeed, ag.accel);
  // Going on is only worth it if it can turn back onto the path past the zone without meeting spikes.
  const onward = leavesSafely(course, params, tx + cx * across, tz + cz * across, cx, cz, ag.maxSpeed);
  const forward = ahead.clearOfSolids(course, r, -0.01) ? ahead.moverRoom(course, zones, r, a.time, 0) : -Infinity;
  if (forward >= 0 && onward) {
    head(out, 1, tx - a.x, tz - a.z);
    return true;
  }
  back.build(a.x, a.z, a.x, a.z, -cx, -cz, zoneDepth(zones, a.x, a.z, -cx, -cz) + 0.2, -a.speed, 0, ag.maxSpeed * ag.backShare, ag.accel);
  const backward = back.clearOfSolids(course, r, -0.01) ? back.moverRoom(course, zones, r, a.time, 0) : -Infinity;
  if (!onward && backward >= 0) {
    // A lane that ends on spikes: back out and pick another.
    head(out, -1, cx, cz);
    return true;
  }
  still.build(a.x, a.z, a.x, a.z, cx, cz, 0, 0, 0, ag.maxSpeed, ag.accel);
  const stay = still.moverRoom(course, zones, r, a.time, 1);
  const best = Math.max(onward ? forward : -Infinity, backward, stay);
  if (best === forward) head(out, 1, tx - a.x, tz - a.z);
  else head(out, best === stay ? 0 : -1, cx, cz);
  return true;
}

function head(out: CrossingOrder, move: number, x: number, z: number): void {
  const len = Math.hypot(x, z);
  out.move = move;
  out.hx = len > 1e-6 ? x / len : 1;
  out.hz = len > 1e-6 ? z / len : 0;
}
