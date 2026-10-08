import { useEffect, type RefObject } from 'react';
import { hudCover } from '@/render/hideseek/camera/hudCover';

/**
 * Keeps hudCover in step with the cards stacked in the viewport's bottom
 * left corner, so the Close view frames the room beside or above them
 * instead of under them. Measured only when the viewport or the stack
 * changes size, never per frame.
 */
export function useHudCover(viewport: RefObject<HTMLElement | null>, stack: RefObject<HTMLElement | null>): void {
  useEffect(() => {
    const v = viewport.current;
    const s = stack.current;
    if (!v || !s) return;
    const measure = () => {
      const vr = v.getBoundingClientRect();
      const sr = s.getBoundingClientRect();
      const empty = sr.width < 1 || sr.height < 1 || vr.width < 1 || vr.height < 1;
      hudCover.w = empty ? 0 : Math.max(0, (sr.right - vr.left) / vr.width);
      hudCover.h = empty ? 0 : Math.max(0, (vr.bottom - sr.top) / vr.height);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(v);
    observer.observe(s);
    measure();
    return () => {
      observer.disconnect();
      hudCover.w = hudCover.h = 0;
    };
  }, [viewport, stack]);
}
