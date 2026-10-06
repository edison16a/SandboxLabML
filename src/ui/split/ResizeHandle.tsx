'use client';

import { GripVertical } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import { cn } from '@/ui/cn';
import { useSplitSize, type SplitSizeOptions } from './useSplitSize';

interface ResizeHandleProps extends SplitSizeOptions {
  /** Which neighbour the handle sizes: the pane just before it or the one just after it. */
  pane: 'before' | 'after';
  /** Accessible name, such as "Resize the side panel". */
  label: string;
  className?: string;
}

/** Pixels an arrow key moves the divider. Shift moves four times as far. */
const STEP = 16;
/** Pixels the pointer must travel before a press counts as a drag, so a click that wobbles a little is still a click. */
const SLOP = 3;

/**
 * A draggable divider between two side by side panes, from the lg
 * breakpoint up. It takes no width of its own: a thin line and a grip fade
 * in over the panes' shared border on hover or focus. Arrow keys move it,
 * and Home or a double click puts it back.
 *
 * The page gives the sized pane a width from the CSS variable, lets it
 * shrink down to a min width, and gives the other pane a min width too.
 * Flexbox then keeps both visible on a narrow window without any code.
 */
export function ResizeHandle({ pane, label, className, ...options }: ResizeHandleProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { size, preview, commit, reset } = useSplitSize(ref, options);
  // Where the drag started, and whether the pointer has moved since. A click that never moves saves nothing.
  const drag = useRef<{ x: number; size: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  // Dragging right grows a pane before the handle and shrinks one after it.
  const sign = pane === 'before' ? 1 : -1;

  /** The width the pane really has. Flexbox may hold it under the requested size when the window is narrow. */
  const measured = () => {
    const el = pane === 'before' ? ref.current?.previousElementSibling : ref.current?.nextElementSibling;
    return el ? el.getBoundingClientRect().width : size;
  };

  // Keep the resize cursor and stop text selection while the pointer is anywhere on the page.
  useEffect(() => {
    if (!dragging) return;
    const root = document.documentElement;
    root.style.cursor = 'col-resize';
    root.style.userSelect = 'none';
    return () => {
      root.style.cursor = '';
      root.style.userSelect = '';
    };
  }, [dragging]);

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, size: measured(), moved: false };
    setDragging(true);
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d || (!d.moved && Math.abs(e.clientX - d.x) < SLOP)) return;
    d.moved = true;
    preview(d.size + sign * (e.clientX - d.x));
  };
  // Saves only after a real drag. A plain click on a pane the window squeezes would otherwise save the squeezed width over the one the person chose.
  const onPointerEnd = () => {
    const d = drag.current;
    if (!d) return;
    drag.current = null;
    setDragging(false);
    if (d.moved) commit(measured());
  };
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (dir !== 0) commit(measured() + sign * dir * (e.shiftKey ? STEP * 4 : STEP));
    else if (e.key === 'Home') reset();
    else return;
    e.preventDefault();
  };

  return (
    <div
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label={label}
      aria-valuenow={size}
      aria-valuemin={options.min}
      aria-valuemax={options.max}
      aria-valuetext={`${size} pixels wide`}
      tabIndex={0}
      data-dragging={dragging || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onLostPointerCapture={onPointerEnd}
      onDoubleClick={reset}
      onKeyDown={onKeyDown}
      className={cn('group relative z-20 hidden w-0 shrink-0 touch-none outline-none select-none lg:block', className)}
    >
      {/* The grab area is wider than the line and overlaps both panes a little, so it is easy to hit. */}
      <div className="absolute inset-y-0 -left-1.5 w-3 cursor-col-resize" />
      <div className="pointer-events-none absolute inset-y-0 left-0 w-0.5 -translate-x-1/2 bg-accent opacity-0 transition-opacity duration-150 group-hover:opacity-60 group-hover:delay-100 group-focus-visible:opacity-100 group-data-dragging:opacity-100" />
      <div className="pointer-events-none absolute top-1/2 left-0 flex h-7 w-3.5 -translate-1/2 items-center justify-center rounded-[4px] border border-border-strong bg-surface-3 text-muted opacity-0 shadow-sm shadow-black/40 transition-opacity duration-150 group-hover:opacity-100 group-hover:delay-100 group-focus-visible:opacity-100 group-data-dragging:opacity-100 group-data-dragging:text-fg">
        <GripVertical className="size-3" />
      </div>
    </div>
  );
}
