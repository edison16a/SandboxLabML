import { BrickWall, Box, Eraser, Flag, Move, MoveHorizontal, Triangle, type LucideIcon } from 'lucide-react';
import type { BlockShape, MoverPace } from '@/engine/navigation/course/edit';

export type EditorTool = 'block' | 'wall' | 'spikes' | 'mover' | 'start' | 'finish' | 'erase';

export interface ToolInfo {
  id: EditorTool;
  label: string;
  key: string;
  icon: LucideIcon;
  /** What the hint line says while this tool is picked. */
  hint: string;
}

/** The key that turns the next long crate. */
export const TURN_KEY = 'T';

/** The editor's tools in toolbar order, each with its shortcut key and hint. */
export const EDITOR_TOOLS: readonly ToolInfo[] = [
  { id: 'block', label: 'Crate', key: 'C', icon: Box, hint: `Click to place a crate. Drag a crate to move it. ${TURN_KEY} turns a long one.` },
  { id: 'wall', label: 'Wall', key: 'W', icon: BrickWall, hint: 'Drag along the grid to draw a wall. Leave gaps for runners to find.' },
  { id: 'spikes', label: 'Spikes', key: 'S', icon: Triangle, hint: 'Drag a rectangle of spikes. Touching them ends a run.' },
  { id: 'mover', label: 'Mover', key: 'M', icon: MoveHorizontal, hint: 'Drag the path a crate slides along, back and forth.' },
  { id: 'start', label: 'Start line', key: 'A', icon: Move, hint: 'Click to move the start line. Runners line up behind it.' },
  { id: 'finish', label: 'Finish line', key: 'F', icon: Flag, hint: 'Click to move the finish line.' },
  { id: 'erase', label: 'Erase', key: 'E', icon: Eraser, hint: 'Click a piece to remove it.' },
];

export function toolForKey(key: string): EditorTool | null {
  return EDITOR_TOOLS.find((t) => t.key.toLowerCase() === key.toLowerCase())?.id ?? null;
}

/** Tools that draw by dragging from one point to another. */
export const DRAG_TOOLS: ReadonlySet<EditorTool> = new Set(['wall', 'spikes', 'mover']);

/** How the next crate and the next mover come out. */
export interface PlaceOptions {
  shape: BlockShape;
  /** A long crate runs across the room, or along it when turned. */
  turned: boolean;
  pace: MoverPace;
}

export const START_OPTIONS: PlaceOptions = { shape: 'small', turned: false, pace: 'medium' };

/** The keyboard part of the hint, the same for every tool. */
export const KEYBOARD_HINT = 'Arrows move the cursor, Enter places, Delete erases, Ctrl+Z undoes.';
