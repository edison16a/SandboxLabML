'use client';

import { forwardRef, useCallback, useRef, useState } from 'react';
import { boxAtPoint, placeBox, snap, straightWall, wallAtPoint } from '@/engine/hideseek/sandbox/roomEdit';
import { BOARD_COLORS, BoardBox, BoardGrid, BoardRoom, HALF, SpawnArea } from './BoardLayers';
import { isBoxTool, placeYaw, type EditorTool, type PlaceYaws } from './editorTools';
import { regionOf, snapped, type BoardInput, type Point } from './useBoardInput';
import type { RoomDraft } from './useRoomDraft';

const PAD = 0.6;
const VIEW = `${-HALF - PAD} ${-HALF - PAD} ${2 * (HALF + PAD)} ${2 * (HALF + PAD)}`;

interface Props {
  draft: RoomDraft;
  /** Owned by the dialog, which needs the wall in progress to decide what Escape does. */
  input: BoardInput;
  tool: EditorTool;
  yaws: PlaceYaws;
}

/**
 * The room from above, drawn in meters on a half meter grid. Pointer and
 * keyboard input go through useBoardInput; this only draws the room and
 * the previews: the wall being dragged, the box about to be placed (red
 * when it does not fit), the spawn area being drawn and the keyboard cursor.
 */
export const EditorBoard = forwardRef<SVGSVGElement, Props>(function EditorBoard({ draft, input, tool, yaws }, ref) {
  const svg = useRef<SVGSVGElement | null>(null);
  /** The cursor shows only while the keyboard drives the board, so it never sits under the mouse. */
  const [keys, setKeys] = useState(false);
  const room = draft.room;

  const toRoom = useCallback((clientX: number, clientY: number): Point | null => {
    const el = svg.current;
    const m = el?.getScreenCTM();
    if (!el || !m) return null;
    const p = new DOMPoint(clientX, clientY).matrixTransform(m.inverse());
    return [Math.max(-HALF, Math.min(HALF, p.x)), Math.max(-HALF, Math.min(HALF, p.y))];
  }, []);

  const g = input.gesture;
  const hover = input.hover;
  const erasing = tool === 'erase' && hover && !g;
  const eraseBox = erasing ? boxAtPoint(room, hover[0], hover[1]) : -1;
  const eraseWall = erasing && eraseBox < 0 ? wallAtPoint(room, hover[0], hover[1]) : -1;
  const boxTool = isBoxTool(tool) ? tool : null;
  const placing = boxTool && hover && !g && boxAtPoint(room, hover[0], hover[1]) < 0;
  const ghostAt = placing ? snapped(hover) : null;
  const ghost = ghostAt && boxTool ? { x: ghostAt[0], z: ghostAt[1], yaw: placeYaw(boxTool, yaws), kind: boxTool } : null;
  const ghostBad = ghost ? !!placeBox(room, ghost.kind, ghost.x, ghost.z, ghost.yaw).error : false;
  const moving = g?.kind === 'move' && g.moved ? room.boxes[g.box] : null;
  const wall = g?.kind === 'wall' ? straightWall(g.start, g.current) : input.pendingWall ? straightWall(input.pendingWall, input.cursor) : null;

  return (
    <svg
      ref={(el) => {
        svg.current = el;
        if (typeof ref === 'function') ref(el);
        else if (ref) ref.current = el;
      }}
      viewBox={VIEW}
      role="application"
      aria-label="Room editor board. Arrow keys move the cursor and Enter places with the current tool."
      tabIndex={0}
      className="block aspect-square w-full touch-none rounded-md outline-none select-none focus-visible:ring-2 focus-visible:ring-accent/70"
      style={{ cursor: tool === 'erase' ? 'pointer' : 'crosshair' }}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        const p = toRoom(e.clientX, e.clientY);
        if (!p) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        e.currentTarget.focus({ preventScroll: true });
        setKeys(false);
        input.down(p);
      }}
      onPointerMove={(e) => {
        const p = toRoom(e.clientX, e.clientY);
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
      <BoardGrid />
      <BoardRoom room={room} eraseWall={eraseWall} eraseBox={eraseBox} hideBox={moving ? g!.box : -1} />
      {g?.kind === 'spawn' && <SpawnArea region={regionOf(g.start, g.current)} team={tool === 'seekers' ? 'seeker' : 'hider'} preview />}
      {wall && (
        <line
          x1={wall.from[0]}
          y1={wall.from[1]}
          x2={wall.to[0]}
          y2={wall.to[1]}
          stroke={BOARD_COLORS.accent}
          strokeWidth={0.26}
          strokeLinecap="square"
          opacity={0.85}
          pointerEvents="none"
        />
      )}
      {moving && g && <BoardBox box={{ ...moving, x: snap(g.current[0] + g.grab[0]), z: snap(g.current[1] + g.grab[1]) }} ghost />}
      {ghost && <BoardBox box={ghost} ghost bad={ghostBad} />}
      <g pointerEvents="none" opacity={0.9}>
        {keys && (
          <g>
            <circle cx={input.cursor[0]} cy={input.cursor[1]} r={0.34} fill="none" stroke={BOARD_COLORS.accent} strokeWidth={0.08} />
            <circle cx={input.cursor[0]} cy={input.cursor[1]} r={0.07} fill={BOARD_COLORS.accent} />
          </g>
        )}
        {input.pendingWall && <circle cx={input.pendingWall[0]} cy={input.pendingWall[1]} r={0.18} fill={BOARD_COLORS.accent} />}
      </g>
    </svg>
  );
});
