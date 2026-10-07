import { distanceToRect, outerWallRects, segmentRect } from '../layouts/geometry';
import type { Rect, Region, WallSegment } from '../layouts/types';
import { boxKindSize, DEFAULT_HIDESEEK_PHYSICS, type BoxKind } from '../physics';
import { SANDBOX_LIMITS, type SandboxBox, type SandboxRoom } from './room';
import { boxMargins, fitRegion } from './validate';

/**
 * Room editing as plain functions on immutable rooms, so the editor's undo
 * is just a list of earlier rooms and every rule here has a unit test.
 * Each edit returns the new room, or a short reason it was refused.
 */
export type EditResult = { room: SandboxRoom; error?: undefined } | { room?: undefined; error: string };

const P = DEFAULT_HIDESEEK_PHYSICS;
const HALF = P.arena.size / 2;
/** Grid step everything snaps to, m. Half a meter lines a cube up with a 1 m doorway. */
export const SNAP = 0.5;
/** Shortest wall, m. */
const MIN_WALL = 0.5;
/** Air kept between a box and anything solid, m. */
const GAP = 0.04;
/** How close a click must be to a wall to pick it, m. */
const PICK = 0.35;

export function snap(v: number): number {
  return Math.max(-HALF, Math.min(HALF, Math.round(v / SNAP) * SNAP));
}

/** A wall from `from` toward `to`, run straight along whichever axis the drag mostly followed. */
export function straightWall(from: [number, number], to: [number, number]): WallSegment {
  const [x0, z0] = from;
  const [x1, z1] = to;
  return Math.abs(x1 - x0) >= Math.abs(z1 - z0) ? { from: [x0, z0], to: [x1, z0] } : { from: [x0, z0], to: [x0, z1] };
}

/** Axis-aligned bounds of a box at its yaw. Exact for boxes turned by quarter turns, which is all the editor makes. */
export function boxRect(b: Pick<SandboxBox, 'x' | 'z' | 'yaw' | 'kind'>): Rect {
  const s = boxKindSize(P, b.kind);
  const c = Math.abs(Math.cos(b.yaw));
  const n = Math.abs(Math.sin(b.yaw));
  return { x: b.x, z: b.z, hx: (s.length * c + s.width * n) / 2, hz: (s.length * n + s.width * c) / 2 };
}

function overlap(a: Rect, b: Rect): boolean {
  return Math.abs(a.x - b.x) < a.hx + b.hx + GAP && Math.abs(a.z - b.z) < a.hz + b.hz + GAP;
}

const wallRect = (w: WallSegment) => segmentRect(w, P.arena.innerWallThickness);

/** Whether a box fits at its spot: inside the room, clear of every wall and of the other boxes. */
function fits(room: SandboxRoom, box: SandboxBox, skip = -1): boolean {
  const r = boxRect(box);
  if ([...outerWallRects(P), ...room.walls.map(wallRect)].some((w) => overlap(r, w))) return false;
  return room.boxes.every((b, i) => i === skip || !overlap(r, boxRect(b)));
}

/** Keeps a box center far enough inside the outer walls for its size and turn. */
function inside(box: SandboxBox): SandboxBox {
  const m = boxMargins(box.kind, box.yaw);
  return { ...box, x: Math.max(-HALF + m.x, Math.min(HALF - m.x, box.x)), z: Math.max(-HALF + m.z, Math.min(HALF - m.z, box.z)) };
}

export function addWall(room: SandboxRoom, from: [number, number], to: [number, number]): EditResult {
  if (room.walls.length >= SANDBOX_LIMITS.walls) return { error: `A room holds ${SANDBOX_LIMITS.walls} walls at most.` };
  const wall = straightWall(from, to);
  if (Math.hypot(wall.to[0] - wall.from[0], wall.to[1] - wall.from[1]) < MIN_WALL) return { error: 'Drag a little further to draw a wall.' };
  const r = wallRect(wall);
  if (room.boxes.some((b) => overlap(boxRect(b), r))) return { error: 'That wall would run through a box. Move or erase the box first.' };
  return { room: { ...room, walls: [...room.walls, wall] } };
}

export function placeBox(room: SandboxRoom, kind: BoxKind, x: number, z: number, yaw: number): EditResult {
  if (room.boxes.length >= SANDBOX_LIMITS.boxes) return { error: `A room holds ${SANDBOX_LIMITS.boxes} boxes at most.` };
  const box = inside({ x, z, yaw, kind });
  if (!fits(room, box)) return { error: 'No space there. Boxes cannot overlap walls or other boxes.' };
  return { room: { ...room, boxes: [...room.boxes, box] } };
}

export function moveBox(room: SandboxRoom, index: number, x: number, z: number): EditResult {
  const old = room.boxes[index];
  if (!old) return { error: 'That box is gone.' };
  const box = inside({ ...old, x, z });
  if (!fits(room, box, index)) return { error: 'No space there. Boxes cannot overlap walls or other boxes.' };
  return { room: { ...room, boxes: room.boxes.map((b, i) => (i === index ? box : b)) } };
}

/**
 * The yaw a quarter turn counterclockwise from `yaw` (seen from above),
 * snapped to 0, PI/2, PI or 3PI/2. A ramp's yaw is its uphill direction,
 * so a ramp needs all four; see turnBox.
 */
export function quarterTurn(yaw: number): number {
  const q = (((Math.round(yaw / (Math.PI / 2)) + 1) % 4) + 4) % 4;
  return (q * Math.PI) / 2;
}

/**
 * Turns a box a quarter turn in place, if it still fits. A crate looks the
 * same both ways round, so it flips between along x and along z. A ramp
 * steps through all four uphill directions.
 */
export function turnBox(room: SandboxRoom, index: number): EditResult {
  const old = room.boxes[index];
  if (!old) return { error: 'That box is gone.' };
  const yaw = old.kind === 'ramp' ? quarterTurn(old.yaw) : Math.abs(Math.sin(old.yaw)) > 0.5 ? 0 : Math.PI / 2;
  const box = inside({ ...old, yaw });
  if (!fits(room, box, index)) return { error: 'No space to turn it there.' };
  return { room: { ...room, boxes: room.boxes.map((b, i) => (i === index ? box : b)) } };
}

/** The box under a point, or -1. Later boxes are drawn on top, so they win. */
export function boxAtPoint(room: SandboxRoom, x: number, z: number): number {
  for (let i = room.boxes.length - 1; i >= 0; i--) if (distanceToRect(x, z, boxRect(room.boxes[i])) <= 0.1) return i;
  return -1;
}

/** The wall nearest a point within picking distance, or -1. */
export function wallAtPoint(room: SandboxRoom, x: number, z: number): number {
  let best = -1;
  let bestD = PICK;
  room.walls.forEach((w, i) => {
    const d = distanceToRect(x, z, wallRect(w));
    if (d <= bestD) {
      best = i;
      bestD = d;
    }
  });
  return best;
}

/** Removes the box under a point, else the wall near it. Null when there is nothing there. */
export function eraseAt(room: SandboxRoom, x: number, z: number): SandboxRoom | null {
  const b = boxAtPoint(room, x, z);
  if (b >= 0) return { ...room, boxes: room.boxes.filter((_, i) => i !== b) };
  const w = wallAtPoint(room, x, z);
  if (w >= 0) return { ...room, walls: room.walls.filter((_, i) => i !== w) };
  return null;
}

/** Sets where a team spawns, kept inside the room and at least a meter each way. */
export function setSpawn(room: SandboxRoom, team: 'hider' | 'seeker', region: Region): SandboxRoom {
  return team === 'hider' ? { ...room, hiderSpawn: fitRegion(region) } : { ...room, seekerSpawn: fitRegion(region) };
}

/** A square spawn area of `side` meters centered on a point, for a click instead of a drag. */
export function spawnAround(x: number, z: number, side = 4): Region {
  const h = side / 2;
  const cx = Math.max(-HALF + h, Math.min(HALF - h, x));
  const cz = Math.max(-HALF + h, Math.min(HALF - h, z));
  return { minX: cx - h, maxX: cx + h, minZ: cz - h, maxZ: cz + h };
}
