import * as THREE from 'three';
import { BOX_COUNT, BOX_KINDS, boxKindSize, DEFAULT_HIDESEEK_PHYSICS, type BoxKind } from '@/engine/hideseek/physics';
import { SANDBOX_BOX_BITS, sandboxAgentAt, sandboxBoxAt, sandboxBoxCount, sandboxBoxKind, sandboxHiderCount, sandboxSeekerCount } from '@/engine/hideseek/sandbox/snapshot';
import { AGENT_X, AGENT_Z, BOX_X, BOX_YAW, BOX_Z } from '@/engine/hideseek/snapshot';
import { agentAt, boxAt } from '../frame/snapshotRead';
import { HS } from '../palette';

const P = DEFAULT_HIDESEEK_PHYSICS;
/**
 * How far off a body a ray end may land and still count as touching it, m.
 * Engine hits sit right on the surface, but the inspected agent's rays are
 * drawn from its blended pose, which can be a step behind.
 */
const TOUCH = 0.15;
const SIZES: Record<BoxKind, { length: number; width: number }> = { cube: boxKindSize(P, 'cube'), plank: boxKindSize(P, 'plank'), ramp: boxKindSize(P, 'ramp') };

/**
 * End dot colors by what a ray touches: crates their gold, ramps their
 * jade (the brain reads both as a box), agents their team color. Pushed
 * past 1 so a dot stays lit against the very box it sits on.
 */
const CRATE = HS.cube.clone().multiplyScalar(1.6);
const RAMP = HS.ramp.clone().multiplyScalar(1.8);
const TEAM = [HS.hider.clone().multiplyScalar(1.3), HS.seeker.clone().multiplyScalar(1.3)];

/** Whether (x, z) lies on the footprint of a box of `kind` at (bx, bz) turned by `yaw`, give or take TOUCH. */
function onBox(x: number, z: number, bx: number, bz: number, yaw: number, kind: BoxKind): boolean {
  const dx = x - bx;
  const dz = z - bz;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const size = SIZES[kind];
  return Math.abs(dx * c - dz * s) <= size.length / 2 + TOUCH && Math.abs(dx * s + dz * c) <= size.width / 2 + TOUCH;
}

function onAgent(x: number, z: number, ax: number, az: number): boolean {
  return Math.hypot(x - ax, z - az) <= P.agent.radius + TOUCH;
}

/**
 * The dot color for a ray of agent `viewer` (0 hider, 1 seeker) of arena
 * `arena` that ends at (x, z), or null when it ends on a wall. Allocates
 * nothing; the colors are shared and must not be changed.
 */
export function arenaHitColor(snap: Float32Array, arena: number, viewer: number, x: number, z: number): THREE.Color | null {
  const o = agentAt(arena, 1 - viewer);
  if (onAgent(x, z, snap[o + AGENT_X], snap[o + AGENT_Z])) return TEAM[1 - viewer];
  for (let b = 0; b < BOX_COUNT; b++) {
    const bo = boxAt(arena, b);
    if (onBox(x, z, snap[bo + BOX_X], snap[bo + BOX_Z], snap[bo + BOX_YAW], BOX_KINDS[b])) return BOX_KINDS[b] === 'ramp' ? RAMP : CRATE;
  }
  return null;
}

/** The same for a Sandbox frame, where `viewer` is a team (0 hiders, 1 seekers) and any player of the other team counts. */
export function sandboxHitColor(curr: Float32Array, viewer: number, x: number, z: number): THREE.Color | null {
  const hiders = sandboxHiderCount(curr);
  const players = hiders + sandboxSeekerCount(curr);
  const to = viewer === 0 ? players : hiders;
  for (let slot = viewer === 0 ? hiders : 0; slot < to; slot++) {
    const o = sandboxAgentAt(slot);
    if (onAgent(x, z, curr[o + AGENT_X], curr[o + AGENT_Z])) return TEAM[1 - viewer];
  }
  for (let b = 0; b < sandboxBoxCount(curr); b++) {
    const o = sandboxBoxAt(players, b);
    const kind = sandboxBoxKind(curr[o + SANDBOX_BOX_BITS]);
    if (onBox(x, z, curr[o + BOX_X], curr[o + BOX_Z], curr[o + BOX_YAW], kind)) return kind === 'ramp' ? RAMP : CRATE;
  }
  return null;
}
