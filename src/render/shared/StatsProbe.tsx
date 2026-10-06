'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';

export interface RenderStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
  heapMb: number;
  instances: Record<string, number>;
}

declare global {
  interface Window {
    __sbl?: { stats: RenderStats };
  }
}

/**
 * Publishes renderer counters on window.__sbl.stats twice a second. Browser
 * tests read these numbers instead of parsing pixels, and the dev overlay
 * shows them.
 */
export function StatsProbe({ instances }: { instances?: () => Record<string, number> }) {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ frames: 0, time: 0 });
  useFrame((_, dt) => {
    acc.current.frames++;
    acc.current.time += dt;
    if (acc.current.time < 0.5) return;
    const info = gl.info;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    window.__sbl = {
      stats: {
        fps: acc.current.frames / acc.current.time,
        frameMs: (acc.current.time / acc.current.frames) * 1000,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        heapMb: mem ? mem.usedJSHeapSize / 1048576 : 0,
        instances: instances?.() ?? {},
      },
    };
    acc.current = { frames: 0, time: 0 };
  });
  return null;
}
