import { useEffect, useRef, useState, type RefObject } from 'react';
import type { LessonPreview } from '@/engine/lessons/preview/types';
import { driveReadout, drawDrive } from './drawDrive';
import { drawMatch, matchReadout } from './drawMatch';
import { advance } from './playback';
import { prepareCanvas } from './view';

/** Draws the frame at `pos` and sets the readout, or clears both when there is nothing to show. Waits until the canvas has a size. */
function paint(canvas: HTMLCanvasElement | null, readout: HTMLElement | null, preview: LessonPreview | null, pos: number): void {
  const ctx = canvas ? prepareCanvas(canvas) : null;
  if (readout) readout.textContent = !preview ? '' : preview.kind === 'racing' ? driveReadout(preview, pos) : matchReadout(preview, pos);
  if (!ctx) return;
  if (!preview) ctx.g.clearRect(0, 0, ctx.w, ctx.h);
  else if (preview.kind === 'racing') drawDrive(ctx.g, ctx.w, ctx.h, preview, pos);
  else drawMatch(ctx.g, ctx.w, ctx.h, preview, pos);
}

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Replays a recorded preview on a canvas at real time. Frames are drawn
 * straight to the canvas and the readout's text is set directly, so the
 * animation never re-renders React. The loop only runs while playing, on
 * screen and in a visible browser tab; a new recording starts from the
 * top. With reduced motion asked for, it starts paused on the first frame.
 */
export function usePlayback(preview: LessonPreview | null, canvas: RefObject<HTMLCanvasElement | null>, readout: RefObject<HTMLElement | null>) {
  const [playing, setPlaying] = useState(() => !reducedMotion());
  const [onScreen, setOnScreen] = useState(true);
  const [pageVisible, setPageVisible] = useState(true);
  const pos = useRef(0);

  useEffect(() => {
    pos.current = 0;
    paint(canvas.current, readout.current, preview, 0);
  }, [preview, canvas, readout]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting));
    io.observe(c);
    // A resize clears the canvas, so draw again even while paused.
    const ro = new ResizeObserver(() => paint(c, readout.current, preview, pos.current));
    ro.observe(c);
    const visibility = () => setPageVisible(!document.hidden);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      io.disconnect();
      ro.disconnect();
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [preview, canvas, readout]);

  const running = playing && onScreen && pageVisible && preview !== null && preview.ticks > 0;
  useEffect(() => {
    if (!running || !preview) return;
    let raf = 0;
    let last = performance.now();
    const frame = (now: number) => {
      pos.current = advance(pos.current, now - last, preview.ticks);
      last = now;
      paint(canvas.current, readout.current, preview, pos.current);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [running, preview, canvas, readout]);

  const restart = () => {
    pos.current = 0;
    paint(canvas.current, readout.current, preview, 0);
  };
  return { playing, toggle: () => setPlaying((p) => !p), restart };
}
