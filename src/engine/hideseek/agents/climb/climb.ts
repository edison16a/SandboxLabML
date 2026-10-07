import { clamp } from '../../../core/math';
import { localAhead, localLeft } from '../../frame';
import type { PlayState } from '../../match/state';
import { rayAabb } from '../../sensing/raycast2d';
import { SPOT_CLEAR, spotBlocker, type SpotHit } from './clearance';
import { planJump, stepJump } from './jump';
import { placeOnRamp, rampPoint, standOnFloor, type FloorPoint } from './ramp';

/** Scratch for spots worked out during a tick, so climbing allocates nothing. */
const spot: FloorPoint = { x: 0, z: 0 };
const hit: SpotHit = { kind: SPOT_CLEAR, index: -1 };

/**
 * Climbing for agent `i`, run every tick before it drives, grabs or locks.
 * In the air it carries on with its jump. On a slope the move output takes
 * it up or down the ramp (the turn output is ignored: it faces uphill). On
 * the floor it may mount a ramp. Both teams climb.
 */
export function updateClimb(s: PlayState, i: number): void {
  const a = s.agents[i];
  if (a.airborne) stepJump(s, i);
  else if (a.climbing) stepClimb(s, i);
  else if (tryMount(s, i)) stepClimb(s, i);
}

/**
 * Mounts the first ramp whose foot agent `i` stands at: its center within
 * footOut m before the foot to footIn m up the slope and within the ramp
 * width, facing within mountAngle of uphill, driving forward above
 * mountMove, free to act and empty handed, with no wall between it and
 * the slope. Its collider then stops touching anything until it is back
 * on the floor.
 */
function tryMount(s: PlayState, i: number): boolean {
  const a = s.agents[i];
  const c = s.controls[i];
  const p = s.physics;
  if (a.frozen || a.holding || c.move <= p.climb.mountMove) return false;
  const r = p.box.ramp;
  const foot = -r.length / 2;
  const minCos = Math.cos(p.climb.mountAngle);
  for (let b = 0; b < s.boxes.length; b++) {
    const ramp = s.boxes[b];
    if (ramp.kind !== 'ramp' || Math.cos(a.yaw - ramp.yaw) < minCos) continue;
    const along = localAhead(a.x - ramp.x, a.z - ramp.z, ramp.yaw);
    const lateral = localLeft(a.x - ramp.x, a.z - ramp.z, ramp.yaw);
    if (along < foot - p.climb.footOut || along > foot + p.climb.footIn || Math.abs(lateral) > r.width / 2) continue;
    if (wallBetween(s, a.x, a.z, rampPoint(ramp, foot + p.climb.footIn, lateral, spot))) continue;
    a.climbing = true;
    a.climbRamp = b;
    a.climbs++;
    c.climb.progress = Math.max(0, along - foot);
    c.climb.lateral = lateral;
    s.arena.setClimbing(i, true);
    return true;
  }
  return false;
}

/**
 * One tick on a slope. Progress moves by the move output times a share of
 * top speed (backing down at the backward share). Backing past the foot
 * steps off onto the floor if there is room, else it stays at the foot of
 * the slope. Reaching the lip jumps off when a landing spot is free, else
 * it waits at the lip. An agent its controller stopped steps off the foot
 * as soon as there is room; until then it stays where it is on the ramp.
 */
function stepClimb(s: PlayState, i: number): void {
  const a = s.agents[i];
  const c = s.controls[i];
  const p = s.physics;
  const length = p.box.ramp.length;
  a.sideSpeed = 0;
  if (a.frozen) {
    a.speed = 0;
    if (!stepOff(s, i)) placeOnRamp(s, i);
    return;
  }
  const top = p.agent.maxSpeed * p.climb.speedShare;
  const move = clamp(c.move, -1, 1);
  a.speed = move >= 0 ? move * top : move * top * p.agent.backwardShare;
  c.climb.progress += a.speed * p.dt;
  if (c.climb.progress < 0) {
    if (stepOff(s, i)) return;
    c.climb.progress = 0;
  }
  if (c.climb.progress >= length) {
    c.climb.progress = length;
    const ramp = s.boxes[a.climbRamp];
    rampPoint(ramp, length / 2, c.climb.lateral, spot);
    if (planJump(s, i, spot.x, spot.z, ramp.yaw)) {
      a.climbing = false;
      a.climbRamp = -1;
      a.airborne = true;
      a.x = spot.x;
      a.z = spot.z;
      a.yaw = ramp.yaw;
      a.elevation = c.climb.startHeight;
      return;
    }
  }
  placeOnRamp(s, i);
}

/** Whether a wall cuts the floor line from (x, z) to `to`, so the two sides of it never connect. */
function wallBetween(s: PlayState, x: number, z: number, to: FloorPoint): boolean {
  const dx = to.x - x;
  const dz = to.z - z;
  const d = Math.hypot(dx, dz);
  if (d < 1e-9) return false;
  const walls = s.arena.walls;
  for (let w = 0; w < walls.length; w++) if (rayAabb(x, z, dx / d, dz / d, walls[w].x, walls[w].z, walls[w].hx, walls[w].hz) < d) return true;
  return false;
}

/** Stands agent `i` on the floor just past the foot of its ramp, facing uphill, if that spot is free. */
function stepOff(s: PlayState, i: number): boolean {
  const a = s.agents[i];
  const p = s.physics;
  const ramp = s.boxes[a.climbRamp];
  rampPoint(ramp, -p.box.ramp.length / 2 - p.agent.radius - 2 * p.climb.landingGap, s.controls[i].climb.lateral, spot);
  if (spotBlocker(s, i, spot.x, spot.z, hit) !== SPOT_CLEAR) return false;
  standOnFloor(s, i, spot.x, spot.z, ramp.yaw);
  return true;
}
