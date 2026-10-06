import { BrickWall, Box, Eraser, RectangleHorizontal, Users, type LucideIcon } from 'lucide-react';

export type EditorTool = 'wall' | 'cube' | 'plank' | 'hiders' | 'seekers' | 'erase';

export interface ToolInfo {
  id: EditorTool;
  label: string;
  key: string;
  icon: LucideIcon;
  /** What the hint line says while this tool is picked. */
  hint: string;
}

/** The editor's tools in toolbar order, each with its shortcut key and hint. */
export const EDITOR_TOOLS: readonly ToolInfo[] = [
  { id: 'wall', label: 'Wall', key: 'W', icon: BrickWall, hint: 'Drag along the grid to draw a wall. It runs straight across or straight down.' },
  { id: 'cube', label: 'Cube', key: 'C', icon: Box, hint: 'Click to place a cube. Drag any box to move it.' },
  { id: 'plank', label: 'Plank', key: 'P', icon: RectangleHorizontal, hint: 'Click to place a plank, R turns it. Click a plank to turn it in place.' },
  { id: 'hiders', label: 'Hider spawn', key: 'H', icon: Users, hint: 'Drag a rectangle where the hiders start. A click sets a 4 m square.' },
  { id: 'seekers', label: 'Seeker spawn', key: 'S', icon: Users, hint: 'Drag a rectangle where the seekers start. A click sets a 4 m square.' },
  { id: 'erase', label: 'Erase', key: 'E', icon: Eraser, hint: 'Click a wall or a box to remove it.' },
];

export function toolForKey(key: string): EditorTool | null {
  return EDITOR_TOOLS.find((t) => t.key.toLowerCase() === key.toLowerCase())?.id ?? null;
}

/** The keyboard part of the hint, the same for every tool. */
export const KEYBOARD_HINT = 'Arrows move the cursor, Enter acts there, Delete erases, Ctrl+Z undoes.';
