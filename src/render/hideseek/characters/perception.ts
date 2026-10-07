import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { CONTACT_HOLD, CONTACT_NONE, CONTACT_PUSH, type CharacterDrive } from './types';

const P = DEFAULT_HIDESEEK_PHYSICS;
/** A box this close to an agent's surface, m, has the agent's hands on it. */
const TOUCH = 0.16;
/** Hands only go to a box within this angle of straight ahead, rad. */
const FRONT = 1.05;
/** An agent notices another this close, m, and glances at it even when neither sees the other. */
const NOTICE = 4;
/** The face the eyes aim at sits this high over the other agent's feet, m. */
const FACE = 1.1;

/** One box on the floor, as the characters' hands need it. Yaw as in the engine; a ramp rises along its local +x. */
export interface BoxShape {
  x: number;
  z: number;
  yaw: number;
  length: number;
  width: number;
  height: number;
  ramp: boolean;
}

export function boxShape(): BoxShape {
  return { x: 0, z: 0, yaw: 0, length: 1, width: 1, height: 1, ramp: false };
}

/**
 * Finds the box an agent has its hands on and reports the middle of that
 * face, its outward normal and the box's height there into the drive: the
 * box it carries (the nearest in its grab cone), else a box it is up
 * against in front of it. Reads only positions the scene already drew, so
 * it is pure presentation and never touches the simulation.
 */
export function findContact(d: CharacterDrive, boxes: readonly BoxShape[], count: number): void {
  d.contact = CONTACT_NONE;
  if (d.frozen || d.airborne || d.climbing) return;
  let best = Infinity;
  const fx = Math.cos(d.yaw);
  const fz = -Math.sin(d.yaw);
  for (let i = 0; i < count; i++) {
    const b = boxes[i];
    const c = Math.cos(b.yaw);
    const s = Math.sin(b.yaw);
    // The agent in the box's own frame, and the nearest point of the box to it.
    const lx = (d.x - b.x) * c - (d.z - b.z) * s;
    const lz = (d.x - b.x) * s + (d.z - b.z) * c;
    const hx = b.length / 2;
    const hz = b.width / 2;
    const gap = Math.hypot(Math.max(0, Math.abs(lx) - hx), Math.max(0, Math.abs(lz) - hz)) - P.agent.radius;
    const toX = b.x - d.x;
    const toZ = b.z - d.z;
    const ahead = (toX * fx + toZ * fz) / Math.max(1e-6, Math.hypot(toX, toZ));
    const centerGap = Math.hypot(toX, toZ);
    const holdable = d.holding && centerGap <= P.grab.range + 0.1 && ahead > Math.cos(P.grab.cone / 2 + 0.2);
    const touching = !d.holding && gap < TOUCH && ahead > Math.cos(FRONT);
    if (!(holdable || touching) || centerGap >= best) continue;
    best = centerGap;
    // The face toward the agent: whichever side it stands furthest out past.
    const onX = Math.abs(lx) - hx > Math.abs(lz) - hz;
    const nlx = onX ? Math.sign(lx) || 1 : 0;
    const nlz = onX ? 0 : Math.sign(lz) || 1;
    const px = onX ? nlx * hx : Math.max(-hx + 0.2, Math.min(hx - 0.2, lx));
    const pz = onX ? Math.max(-hz + 0.2, Math.min(hz - 0.2, lz)) : nlz * hz;
    // Back to the world: the inverse of the turn above.
    d.contactX = b.x + px * c + pz * s;
    d.contactZ = b.z - px * s + pz * c;
    d.contactNX = nlx * c + nlz * s;
    d.contactNZ = -nlx * s + nlz * c;
    d.contactHeight = b.ramp ? b.height * Math.min(1, Math.max(0.15, (px + hx) / b.length)) : b.height;
    d.contact = d.holding ? CONTACT_HOLD : CONTACT_PUSH;
  }
}

/** Points the eyes at another agent standing at (x, z), `elevation` m up. */
export function lookAt(d: CharacterDrive, x: number, z: number, elevation: number): void {
  d.look = true;
  d.lookX = x;
  d.lookZ = z;
  d.lookY = elevation + FACE;
}

/**
 * Whether an agent cares about another at (x, z) right now: always when
 * one of them sees the other, else when it is close enough to notice.
 */
export function worthALook(d: CharacterDrive, x: number, z: number, sighted: boolean): boolean {
  return !d.frozen && (sighted || Math.hypot(x - d.x, z - d.z) < NOTICE);
}
