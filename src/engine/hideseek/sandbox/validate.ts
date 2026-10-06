import type { Region, WallSegment } from '../layouts/types';
import { DEFAULT_HIDESEEK_PHYSICS } from '../physics';
import { SANDBOX_LIMITS, type SandboxBox, type SandboxRoom } from './room';

const HALF = DEFAULT_HIDESEEK_PHYSICS.arena.size / 2;
/** Smallest spawn area side, m. */
export const MIN_SPAWN_SIDE = 1;
const MAX_NAME = 40;

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

function wall(raw: unknown): WallSegment | null {
  const w = raw as { from?: unknown; to?: unknown } | null;
  if (!w || !Array.isArray(w.from) || !Array.isArray(w.to)) return null;
  const [x0, z0] = w.from as unknown[];
  const [x1, z1] = w.to as unknown[];
  if (!num(x0) || !num(z0) || !num(x1) || !num(z1)) return null;
  const from: [number, number] = [clamp(x0, -HALF, HALF), clamp(z0, -HALF, HALF)];
  const to: [number, number] = [clamp(x1, -HALF, HALF), clamp(z1, -HALF, HALF)];
  const straight = from[0] === to[0] || from[1] === to[1];
  const long = Math.hypot(to[0] - from[0], to[1] - from[1]) >= 0.25;
  return straight && long ? { from, to } : null;
}

/**
 * How far a box center must stay from the outer walls, m: its half
 * extent along that axis at its yaw, plus a little, so a box never starts
 * poking through a wall whichever way it is turned.
 */
export function boxMargins(kind: SandboxBox['kind'], yaw: number): { x: number; z: number } {
  const s = kind === 'cube' ? DEFAULT_HIDESEEK_PHYSICS.box.cube : DEFAULT_HIDESEEK_PHYSICS.box.plank;
  const c = Math.abs(Math.cos(yaw));
  const n = Math.abs(Math.sin(yaw));
  return { x: (s.length * c + s.width * n) / 2 + 0.05, z: (s.length * n + s.width * c) / 2 + 0.05 };
}

function box(raw: unknown): SandboxBox | null {
  const b = raw as Partial<SandboxBox> | null;
  if (!b || !num(b.x) || !num(b.z) || (b.kind !== 'cube' && b.kind !== 'plank')) return null;
  const yaw = num(b.yaw) ? b.yaw : 0;
  const m = boxMargins(b.kind, yaw);
  return { x: clamp(b.x, -HALF + m.x, HALF - m.x), z: clamp(b.z, -HALF + m.z, HALF - m.z), yaw, kind: b.kind };
}

/** A spawn area kept inside the room and at least MIN_SPAWN_SIDE on each side. */
export function fitRegion(r: Region): Region {
  const minX = clamp(Math.min(r.minX, r.maxX), -HALF, HALF - MIN_SPAWN_SIDE);
  const minZ = clamp(Math.min(r.minZ, r.maxZ), -HALF, HALF - MIN_SPAWN_SIDE);
  return {
    minX,
    minZ,
    maxX: clamp(Math.max(r.minX, r.maxX), minX + MIN_SPAWN_SIDE, HALF),
    maxZ: clamp(Math.max(r.minZ, r.maxZ), minZ + MIN_SPAWN_SIDE, HALF),
  };
}

function region(raw: unknown, fallback: Region): Region {
  const r = raw as Partial<Region> | null;
  if (!r || !num(r.minX) || !num(r.maxX) || !num(r.minZ) || !num(r.maxZ)) return fallback;
  return fitRegion(r as Region);
}

/**
 * A room read back from storage or built in the editor, made safe to
 * play: walls straight and inside the room, boxes inside the walls,
 * spawn areas big enough, and every list within SANDBOX_LIMITS. Returns
 * null when it is not a room at all.
 */
export function sanitizeRoom(raw: unknown): SandboxRoom | null {
  const r = raw as Partial<SandboxRoom> | null;
  if (!r || typeof r.id !== 'string' || !r.id || !Array.isArray(r.walls) || !Array.isArray(r.boxes)) return null;
  const name = typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, MAX_NAME) : 'Custom room';
  const hider = region(r.hiderSpawn, { minX: -8, maxX: -2, minZ: -3, maxZ: 3 });
  const seeker = region(r.seekerSpawn, { minX: 2, maxX: 8, minZ: -3, maxZ: 3 });
  return {
    id: r.id,
    name,
    walls: r.walls
      .map(wall)
      .filter((w): w is WallSegment => w !== null)
      .slice(0, SANDBOX_LIMITS.walls),
    boxes: r.boxes
      .map(box)
      .filter((b): b is SandboxBox => b !== null)
      .slice(0, SANDBOX_LIMITS.boxes),
    hiderSpawn: hider,
    seekerSpawn: seeker,
  };
}
