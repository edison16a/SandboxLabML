import { BrickWall, Box, Eraser, RectangleHorizontal, TriangleRight, Users, type LucideIcon } from 'lucide-react';
import { quarterTurn } from '@/engine/hideseek/sandbox/roomEdit';

export type EditorTool = 'wall' | 'cube' | 'plank' | 'ramp' | 'hiders' | 'seekers' | 'erase';

/** The tools that place a box, named by the kind they place. */
export type BoxTool = 'cube' | 'plank' | 'ramp';

export interface ToolInfo {
  id: EditorTool;
  label: string;
  key: string;
  icon: LucideIcon;
  /** What the hint line says while this tool is picked. */
  hint: string;
}

/** The key that turns the next plank or ramp. R places ramps, so turning is T. */
export const TURN_KEY = 'T';

/** The editor's tools in toolbar order, each with its shortcut key and hint. */
export const EDITOR_TOOLS: readonly ToolInfo[] = [
  { id: 'wall', label: 'Wall', key: 'W', icon: BrickWall, hint: 'Drag along the grid to draw a wall. It runs straight across or straight down.' },
  { id: 'cube', label: 'Cube', key: 'C', icon: Box, hint: 'Click to place a cube. Drag any box to move it.' },
  { id: 'plank', label: 'Plank', key: 'P', icon: RectangleHorizontal, hint: `Click to place a plank, ${TURN_KEY} turns it. Click a plank to turn it in place.` },
  {
    id: 'ramp',
    label: 'Ramp',
    key: 'R',
    icon: TriangleRight,
    hint: `Click to place a ramp, ${TURN_KEY} turns it. The chevrons point uphill, and agents jump off the high end. Click a ramp to turn it.`,
  },
  { id: 'hiders', label: 'Hider spawn', key: 'H', icon: Users, hint: 'Drag a rectangle where the hiders start. A click sets a 4 m square.' },
  { id: 'seekers', label: 'Seeker spawn', key: 'S', icon: Users, hint: 'Drag a rectangle where the seekers start. A click sets a 4 m square.' },
  { id: 'erase', label: 'Erase', key: 'E', icon: Eraser, hint: 'Click a wall or a box to remove it.' },
];

export function toolForKey(key: string): EditorTool | null {
  return EDITOR_TOOLS.find((t) => t.key.toLowerCase() === key.toLowerCase())?.id ?? null;
}

export function isBoxTool(tool: EditorTool): tool is BoxTool {
  return tool === 'cube' || tool === 'plank' || tool === 'ramp';
}

/**
 * Which way the next plank and the next ramp are placed. A plank lies
 * across (yaw 0) or down (PI/2); a ramp's yaw is its uphill direction, so
 * it takes any quarter turn.
 */
export interface PlaceYaws {
  plank: number;
  ramp: number;
}

export const START_YAWS: PlaceYaws = { plank: 0, ramp: 0 };

/** The yaw a box tool places at. Cubes look the same every way, so they always go down square. */
export function placeYaw(tool: BoxTool, yaws: PlaceYaws): number {
  return tool === 'cube' ? 0 : yaws[tool];
}

/** What the turn key does: turns the next ramp while the ramp tool is picked, else flips the next plank. */
export function turnNext(tool: EditorTool, yaws: PlaceYaws): PlaceYaws {
  if (tool === 'ramp') return { ...yaws, ramp: quarterTurn(yaws.ramp) };
  return { ...yaws, plank: yaws.plank === 0 ? Math.PI / 2 : 0 };
}

/** The keyboard part of the hint, the same for every tool. */
export const KEYBOARD_HINT = 'Arrows move the cursor, Enter acts there, Delete erases, Ctrl+Z undoes.';
