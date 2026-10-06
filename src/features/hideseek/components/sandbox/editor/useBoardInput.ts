'use client';

import { useCallback, useState } from 'react';
import type { Region } from '@/engine/hideseek/layouts/types';
import { addWall, boxAtPoint, eraseAt, moveBox, placeBox, setSpawn, snap, spawnAround, turnBox } from '@/engine/hideseek/sandbox/roomEdit';
import type { EditorTool } from './editorTools';
import type { RoomDraft } from './useRoomDraft';

export type Point = [number, number];

/** A press on the board that is still going: drawing a wall, a spawn area, or dragging a box. */
export interface Gesture {
  kind: 'wall' | 'spawn' | 'move';
  start: Point;
  current: Point;
  /** The box being dragged, and where on it the press landed. */
  box: number;
  grab: Point;
  moved: boolean;
}

/** A drag shorter than this is a click, m. */
const CLICK = 0.25;

export function regionOf(a: Point, b: Point): Region {
  return { minX: Math.min(a[0], b[0]), maxX: Math.max(a[0], b[0]), minZ: Math.min(a[1], b[1]), maxZ: Math.max(a[1], b[1]) };
}

export const snapped = (p: Point): Point => [snap(p[0]), snap(p[1])];

/**
 * What the pointer and the keyboard do on the editor board, for each tool.
 * Positions come in as room meters; everything placed snaps to the grid.
 * The keyboard drives a cursor, and Enter does what a click would there
 * (for a wall, the first Enter starts it and the second ends it).
 */
export function useBoardInput(draft: RoomDraft, tool: EditorTool, plankYaw: number) {
  const [gesture, setGesture] = useState<Gesture | null>(null);
  /** Where the pointer is over the board, unsnapped, so erase can pick exactly what is under it. */
  const [hover, setHover] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point>([0, 0]);
  const [pendingWall, setPendingWall] = useState<Point | null>(null);
  const room = draft.room;

  /** A click (or Enter) at a point, for the tools where a click does something by itself. */
  const clickAt = useCallback(
    (p: Point) => {
      const s = snapped(p);
      if (tool === 'erase') {
        const next = eraseAt(room, p[0], p[1]);
        return next ? draft.apply(next) : draft.flash('Nothing to erase there.');
      }
      if (tool === 'cube' || tool === 'plank') return draft.edit(placeBox(room, tool, s[0], s[1], tool === 'plank' ? plankYaw : 0));
      if (tool === 'hiders' || tool === 'seekers') return draft.apply(setSpawn(room, tool === 'hiders' ? 'hider' : 'seeker', spawnAround(s[0], s[1])));
    },
    [draft, room, tool, plankYaw],
  );

  const down = useCallback(
    (p: Point) => {
      const s = snapped(p);
      const base = { start: s, current: s, box: -1, grab: [0, 0] as Point, moved: false };
      if (tool === 'wall') return setGesture({ kind: 'wall', ...base });
      if (tool === 'hiders' || tool === 'seekers') return setGesture({ kind: 'spawn', ...base });
      if (tool === 'cube' || tool === 'plank') {
        const box = boxAtPoint(room, p[0], p[1]);
        if (box >= 0) return setGesture({ kind: 'move', ...base, start: p, current: p, box, grab: [room.boxes[box].x - p[0], room.boxes[box].z - p[1]] });
      }
      clickAt(p);
    },
    [room, tool, clickAt],
  );

  const move = useCallback((p: Point) => {
    setHover(p);
    setGesture((g) => {
      if (!g) return g;
      const current = g.kind === 'move' ? p : snapped(p);
      return { ...g, current, moved: g.moved || Math.hypot(p[0] - g.start[0], p[1] - g.start[1]) > CLICK };
    });
  }, []);

  const up = useCallback(() => {
    const g = gesture;
    setGesture(null);
    if (!g) return;
    if (g.kind === 'wall') return draft.edit(addWall(room, g.start, g.current));
    if (g.kind === 'spawn') {
      const team = tool === 'seekers' ? 'seeker' : 'hider';
      return draft.apply(setSpawn(room, team, g.moved ? regionOf(g.start, g.current) : spawnAround(g.start[0], g.start[1])));
    }
    if (g.moved) return draft.edit(moveBox(room, g.box, snap(g.current[0] + g.grab[0]), snap(g.current[1] + g.grab[1])));
    if (tool === 'plank' && room.boxes[g.box]?.kind === 'plank') draft.edit(turnBox(room, g.box));
  }, [gesture, draft, room, tool]);

  /** Arrow keys, Enter and Delete on the focused board. Returns true when the key was used. Escape goes through cancel. */
  const key = useCallback(
    (k: string, shift: boolean): boolean => {
      const step = shift ? 2 : 0.5;
      const nudge: Record<string, Point> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (nudge[k]) {
        setCursor((c) => snapped([c[0] + nudge[k][0], c[1] + nudge[k][1]]));
        return true;
      }
      if (k === 'Enter' || k === ' ') {
        if (tool !== 'wall') clickAt(cursor);
        else if (!pendingWall) setPendingWall(cursor);
        else {
          draft.edit(addWall(room, pendingWall, cursor));
          setPendingWall(null);
        }
        return true;
      }
      if (k === 'Delete' || k === 'Backspace') {
        const next = eraseAt(room, cursor[0], cursor[1]);
        if (next) draft.apply(next);
        else draft.flash('Nothing to erase under the cursor.');
        return true;
      }
      return false;
    },
    [tool, cursor, pendingWall, clickAt, draft, room],
  );

  /** Drops a wall or drag in progress. Returns true when there was one, so Escape can stop there. */
  const cancel = useCallback((): boolean => {
    if (!pendingWall && !gesture) return false;
    setPendingWall(null);
    setGesture(null);
    return true;
  }, [pendingWall, gesture]);

  return { gesture, hover, cursor, pendingWall, down, move, up, key, cancel, leave: () => setHover(null) };
}

export type BoardInput = ReturnType<typeof useBoardInput>;
