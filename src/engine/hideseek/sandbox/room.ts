import type { Pose } from '../frame';
import { outerWallRects, segmentRect } from '../layouts/geometry';
import { HIDESEEK_LAYOUT_IDS, HIDESEEK_LAYOUTS } from '../layouts/presets';
import type { HideSeekLayoutId, Rect, Region, WallSegment } from '../layouts/types';
import { BOX_KINDS, type BoxKind, type HideSeekPhysics } from '../physics';

/** A box the user placed: where it starts and what it is. */
export interface SandboxBox extends Pose {
  kind: BoxKind;
}

/**
 * A room for the Sandbox. Same shape as a built-in layout, but with any
 * number of boxes of either kind, so a preset and a room the user drew are
 * played by the same code. Stored as plain JSON.
 */
export interface SandboxRoom {
  /** A layout id for the built-in rooms, a generated id for the user's own. */
  id: string;
  name: string;
  walls: WallSegment[];
  boxes: SandboxBox[];
  hiderSpawn: Region;
  seekerSpawn: Region;
}

/**
 * Limits that keep a Sandbox match smooth in a worker at 30 ticks a
 * second: every seeker checks its sight of every hider each tick.
 */
export const SANDBOX_LIMITS = { playersPerTeam: 8, boxes: 24, walls: 48 } as const;

/** Half the room side, m. Every room shares the 20 x 20 m outer walls. */
export function roomHalf(p: HideSeekPhysics): number {
  return p.arena.size / 2;
}

/** A built-in layout as a Sandbox room: its walls, its four boxes and both spawn areas. */
export function presetRoom(id: HideSeekLayoutId): SandboxRoom {
  const l = HIDESEEK_LAYOUTS[id];
  return {
    id: l.id,
    name: l.name,
    walls: l.walls.map((w) => ({ from: [...w.from], to: [...w.to] })),
    boxes: l.boxes.map((b, i) => ({ x: b.x, z: b.z, yaw: b.yaw, kind: BOX_KINDS[i] })),
    hiderSpawn: { ...l.hiderSpawn },
    seekerSpawn: { ...l.seekerSpawn },
  };
}

/** Every built-in room, in the order the picker shows them. */
export const PRESET_ROOMS: readonly SandboxRoom[] = HIDESEEK_LAYOUT_IDS.map(presetRoom);

export function isPresetRoomId(id: string): id is HideSeekLayoutId {
  return (HIDESEEK_LAYOUT_IDS as readonly string[]).includes(id);
}

/** Every wall of a room as floor rectangles, outer walls first, like arenaWallRects for a layout. */
export function roomWallRects(room: SandboxRoom, p: HideSeekPhysics): Rect[] {
  return [...outerWallRects(p), ...room.walls.map((w) => segmentRect(w, p.arena.innerWallThickness))];
}

/** An empty room with the default spawn areas, for starting from scratch. */
export function emptyRoom(id: string, name: string): SandboxRoom {
  const open = HIDESEEK_LAYOUTS.open;
  return { id, name, walls: [], boxes: [], hiderSpawn: { ...open.hiderSpawn }, seekerSpawn: { ...open.seekerSpawn } };
}
