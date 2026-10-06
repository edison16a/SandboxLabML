'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';

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
 *
 * three resets its counters at every render call, so with post-processing,
 * shadow passes or picture in picture the numbers would only describe the
 * last pass. With `wholeFrame` the probe takes over the reset and counts
 * every pass of a frame together.
 */
export function StatsProbe({ instances, wholeFrame = false }: { instances?: () => Record<string, number>; wholeFrame?: boolean }) {
  const gl = useThree((s) => s.gl);
  const acc = useRef({ frames: 0, time: 0 });
  const last = useRef({ calls: 0, triangles: 0 });
  useEffect(() => {
    if (!wholeFrame) return;
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl, wholeFrame]);
  useFrame((_, dt) => {
    if (wholeFrame) {
      // Runs before this frame renders, so the counters hold the whole previous frame.
      last.current = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
      gl.info.reset();
    }
    acc.current.frames++;
    acc.current.time += dt;
    if (acc.current.time < 0.5) return;
    const info = wholeFrame ? { render: last.current } : gl.info;
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
