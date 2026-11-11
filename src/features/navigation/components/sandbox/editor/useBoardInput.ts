'use client';

import { useCallback, useState } from 'react';
import { addMover, addSpikes, addWall, eraseAt, moveObstacle, obstacleAt, placeBlock, setLine, snap, type Point } from '@/engine/navigation/course/edit';
import { DRAG_TOOLS, type EditorTool, type PlaceOptions } from './editorTools';
import type { CourseDraft } from './useCourseDraft';

export type { Point };

/** A press on the board that is still going: a drag that draws a piece, or one that moves a crate. */
export interface Gesture {
  kind: 'draw' | 'move';
  start: Point;
  current: Point;
  /** The piece being moved. */
  piece: number;
  moved: boolean;
}

/** A drag shorter than this is a click, m. */
const CLICK = 0.25;

export const snapped = (p: Point): Point => [snap(p[0]), snap(p[1])];

/**
 * What the pointer and the keyboard do on the course board, for each tool.
 * Positions come in as course meters; everything placed snaps to the half
 * meter grid. The keyboard drives a cursor: Enter does what a click would
 * there, and for a tool that draws by dragging the first Enter starts the
 * piece and the second ends it.
 */
export function useBoardInput(draft: CourseDraft, tool: EditorTool, options: PlaceOptions) {
  const [gesture, setGesture] = useState<Gesture | null>(null);
  /** Where the pointer is over the board, unsnapped, so erase picks exactly what is under it. */
  const [hover, setHover] = useState<Point | null>(null);
  const [cursor, setCursor] = useState<Point>([0, 0]);
  const [pending, setPending] = useState<Point | null>(null);
  const spec = draft.spec;

  /** Draws the dragged piece of the current tool from a to b. */
  const draw = useCallback(
    (a: Point, b: Point) => {
      if (tool === 'wall') draft.edit(addWall(spec, a, b));
      else if (tool === 'spikes') draft.edit(addSpikes(spec, a, b));
      else if (tool === 'mover') draft.edit(addMover(spec, a, b, options.pace));
    },
    [draft, spec, tool, options.pace],
  );

  /** A click (or Enter) at a point, for the tools where a click does something by itself. */
  const clickAt = useCallback(
    (p: Point) => {
      if (tool === 'erase') {
        const next = eraseAt(spec, p[0], p[1]);
        return next ? draft.apply(next) : draft.flash('Nothing to erase there.');
      }
      if (tool === 'block') return draft.edit(placeBlock(spec, p[0], p[1], options.shape, options.turned));
      if (tool === 'start' || tool === 'finish') return draft.edit(setLine(spec, tool, p[0]));
    },
    [draft, spec, tool, options],
  );

  const down = useCallback(
    (p: Point) => {
      const s = snapped(p);
      if (DRAG_TOOLS.has(tool)) return setGesture({ kind: 'draw', start: s, current: s, piece: -1, moved: false });
      const hit = tool === 'block' ? obstacleAt(spec, p[0], p[1]) : -1;
      if (hit >= 0 && spec.obstacles[hit].kind === 'block') return setGesture({ kind: 'move', start: p, current: p, piece: hit, moved: false });
      clickAt(p);
    },
    [spec, tool, clickAt],
  );

  const move = useCallback((p: Point) => {
    setHover(p);
    setGesture((g) => (g ? { ...g, current: g.kind === 'move' ? p : snapped(p), moved: g.moved || Math.hypot(p[0] - g.start[0], p[1] - g.start[1]) > CLICK } : g));
  }, []);

  const up = useCallback(() => {
    const g = gesture;
    setGesture(null);
    if (!g) return;
    if (g.kind === 'draw') return draw(g.start, g.current);
    if (g.moved) draft.edit(moveObstacle(spec, g.piece, g.current[0] - g.start[0], g.current[1] - g.start[1]));
  }, [gesture, draw, draft, spec]);

  /** Arrow keys, Enter and Delete on the focused board. Returns true when the key was used. Escape goes through cancel. */
  const key = useCallback(
    (k: string, shift: boolean): boolean => {
      const step = shift ? 2 : 0.5;
      const nudge: Record<string, Point> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      if (nudge[k]) {
        const [hl, hw] = [spec.length / 2, spec.width / 2];
        setCursor((c) => snapped([Math.max(-hl, Math.min(hl, c[0] + nudge[k][0])), Math.max(-hw, Math.min(hw, c[1] + nudge[k][1]))]));
        return true;
      }
      if (k === 'Enter' || k === ' ') {
        if (!DRAG_TOOLS.has(tool)) clickAt(cursor);
        else if (!pending) setPending(cursor);
        else {
          draw(pending, cursor);
          setPending(null);
        }
        return true;
      }
      if (k === 'Delete' || k === 'Backspace') {
        const next = eraseAt(spec, cursor[0], cursor[1]);
        if (next) draft.apply(next);
        else draft.flash('Nothing to erase under the cursor.');
        return true;
      }
      return false;
    },
    [tool, cursor, pending, clickAt, draw, draft, spec],
  );

  /** Drops a piece or drag in progress. Returns true when there was one, so Escape can stop there. */
  const cancel = useCallback((): boolean => {
    if (!pending && !gesture) return false;
    setPending(null);
    setGesture(null);
    return true;
  }, [pending, gesture]);

  return { gesture, hover, cursor, pending, down, move, up, key, cancel, leave: () => setHover(null) };
}

export type BoardInput = ReturnType<typeof useBoardInput>;
