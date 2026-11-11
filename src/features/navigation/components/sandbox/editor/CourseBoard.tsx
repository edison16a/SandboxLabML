'use client';

import { forwardRef, useCallback, useRef, useState } from 'react';
import { addMover, addSpikes, addWall, moveObstacle, obstacleAt, placeBlock, snap, type EditResult } from '@/engine/navigation/course/edit';
import type { ObstacleSpec } from '@/engine/navigation/course/types';
import { BOARD, BoardGrid, BoardLines, BoardPiece, BoardPieces } from './BoardLayers';
import type { EditorTool, PlaceOptions } from './editorTools';
import { snapped, type BoardInput, type Point } from './useBoardInput';
import type { CourseDraft } from './useCourseDraft';

const PAD = 0.7;

interface Props {
  draft: CourseDraft;
  /** Owned by the dialog, which needs the piece in progress to decide what Escape does. */
  input: BoardInput;
  tool: EditorTool;
  options: PlaceOptions;
}

/** The new piece an edit would add, and whether the rules refuse it, for the see through preview. */
function previewOf(result: EditResult, fallback: ObstacleSpec | null): { piece: ObstacleSpec | null; bad: boolean } {
  if (result.spec) return { piece: result.spec.obstacles[result.spec.obstacles.length - 1] ?? null, bad: false };
  return { piece: fallback, bad: true };
}

/**
 * The course from above, drawn in meters on a half meter grid, start on
 * the left. Pointer and keyboard input go through useBoardInput; this only
 * draws the course and the previews: the piece being dragged or about to
 * be placed (red when it does not fit), a moved line, the piece erase
 * would remove, and the keyboard cursor.
 */
export const CourseBoard = forwardRef<SVGSVGElement, Props>(function CourseBoard({ draft, input, tool, options }, ref) {
  const svg = useRef<SVGSVGElement | null>(null);
  /** The cursor shows only while the keyboard drives the board, so it never sits under the mouse. */
  const [keys, setKeys] = useState(false);
  const spec = draft.spec;
  const hl = spec.length / 2;
  const hw = spec.width / 2;

  const toCourse = useCallback(
    (clientX: number, clientY: number): Point | null => {
      const m = svg.current?.getScreenCTM();
      if (!m) return null;
      const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
      return [Math.max(-hl, Math.min(hl, p.x)), Math.max(-hw, Math.min(hw, p.y))];
    },
    [hl, hw],
  );

  const g = input.gesture;
  const at = keys ? input.cursor : input.hover;
  const from = g?.kind === 'draw' ? g.start : input.pending;
  const to = g?.kind === 'draw' ? g.current : input.pending ? input.cursor : null;
  let preview: { piece: ObstacleSpec | null; bad: boolean } = { piece: null, bad: false };
  if (from && to) {
    const r = tool === 'wall' ? addWall(spec, from, to) : tool === 'spikes' ? addSpikes(spec, from, to) : tool === 'mover' ? addMover(spec, from, to, options.pace) : null;
    if (r) preview = previewOf(r, null);
  } else if (g?.kind === 'move' && g.moved) {
    preview = previewOf(moveObstacle(spec, g.piece, g.current[0] - g.start[0], g.current[1] - g.start[1]), null);
    if (!preview.piece) {
      const o = spec.obstacles[g.piece];
      preview.piece = o?.kind === 'block' ? { ...o, x: o.x + snap(g.current[0] - g.start[0]), z: o.z + snap(g.current[1] - g.start[1]) } : null;
    }
  } else if (tool === 'block' && at && obstacleAt(spec, at[0], at[1]) < 0) {
    const [x, z] = snapped(at);
    const r = placeBlock(spec, x, z, options.shape, options.turned);
    preview = previewOf(r, { kind: 'block', x, z, hx: 0.5, hz: 0.5, height: 1 });
  }
  const erasing = tool === 'erase' && at && !g ? obstacleAt(spec, at[0], at[1]) : -1;
  const linePreview = (tool === 'start' || tool === 'finish') && at ? { line: tool, x: snap(at[0]) } : null;
  const moving = g?.kind === 'move' && g.moved ? g.piece : -1;
  const drawLine = from && to && preview.bad && tool === 'wall';

  return (
    <svg
      ref={(el) => {
        svg.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      viewBox={`${-hl - PAD} ${-hw - PAD} ${spec.length + 2 * PAD} ${spec.width + 2 * PAD}`}
      role="application"
      aria-label="Course editor board. Arrow keys move the cursor and Enter places with the current tool."
      tabIndex={0}
      data-testid="course-board"
      className="block w-full touch-none rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-accent/70"
      style={{ aspectRatio: `${spec.length + 2 * PAD} / ${spec.width + 2 * PAD}`, cursor: tool === 'erase' ? 'pointer' : 'crosshair' }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const p = toCourse(e.clientX, e.clientY);
        if (!p) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.focus({ preventScroll: true });
        setKeys(false);
        input.down(p);
      }}
      onPointerMove={(e) => {
        const p = toCourse(e.clientX, e.clientY);
        if (p) input.move(p);
      }}
      onPointerUp={() => input.up()}
      onPointerLeave={input.leave}
      onKeyDown={(e) => {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (input.key(e.key, e.shiftKey)) {
          setKeys(true);
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      onBlur={() => setKeys(false)}
    >
      <BoardGrid length={spec.length} width={spec.width} />
      <BoardLines spec={spec} preview={linePreview} />
      <BoardPieces spec={spec} highlight={erasing} hide={moving} />
      {preview.piece && <BoardPiece o={preview.piece} ghost bad={preview.bad} />}
      {drawLine && <line x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]} stroke={BOARD.bad} strokeWidth={0.2} strokeLinecap="square" opacity={0.8} pointerEvents="none" />}
      <g pointerEvents="none" opacity={0.9}>
        {keys && (
          <g>
            <circle cx={input.cursor[0]} cy={input.cursor[1]} r={0.34} fill="none" stroke={BOARD.accent} strokeWidth={0.08} />
            <circle cx={input.cursor[0]} cy={input.cursor[1]} r={0.07} fill={BOARD.accent} />
          </g>
        )}
        {input.pending && <circle cx={input.pending[0]} cy={input.pending[1]} r={0.18} fill={BOARD.accent} />}
      </g>
    </svg>
  );
});
