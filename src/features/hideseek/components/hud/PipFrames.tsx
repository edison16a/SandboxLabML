'use client';

import { useEffect, useRef, useState } from 'react';
import { pipRects, PIP_AGENTS } from '@/render/hideseek/showcase/pipLayout';
import { useArenaPulse } from '../../hooks/useArenaPulse';
import { useHideSeekLab } from '../../state/hideSeekStore';

/**
 * Frames and labels around the two first person views. The pictures are
 * drawn by the 3D canvas into the same rectangles (see pipLayout), so this
 * only has to measure the viewport and put a border and a caption there.
 */
export function PipFrames() {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const visible = useHideSeekLab((s) => s.pov && s.activeTier !== 'low' && !s.photoMode && (s.mode === 'sandbox' || s.gridSize === 1 || s.focus !== null));
  const pulse = useArenaPulse();
  useEffect(() => {
    const el = host.current?.parentElement;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const rects = size.w > 0 ? pipRects(size.w, size.h) : null;
  return (
    <div ref={host} className="pointer-events-none absolute inset-0">
      {visible &&
        rects?.map((r, k) => {
          const seeker = PIP_AGENTS[k] === 1;
          return (
            <div
              key={k}
              className={`absolute rounded-[3px] ring-1 ${seeker ? 'ring-seeker/60' : 'ring-hider/60'}`}
              style={{ left: r.left, top: r.top, width: r.width, height: r.height }}
            >
              <span className={`absolute -top-5 left-0 rounded-sm px-1.5 py-px text-[10px] font-semibold tracking-wide text-white uppercase ${seeker ? 'bg-seeker/70' : 'bg-hider/70'}`}>
                {seeker ? 'Seeker view' : 'Hider view'}
              </span>
              {seeker && pulse.prep && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-[11px] font-medium text-white/80">Blind during prep</span>
              )}
            </div>
          );
        })}
    </div>
  );
}
