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
  const quiet = useRef<{ timer: ReturnType<typeof setTimeout> | null; at: number }>({ timer: null, at: 0 });
  useEffect(() => {
    if (!wholeFrame) return;
    gl.info.autoReset = false;
    return () => {
      gl.info.autoReset = true;
    };
  }, [gl, wholeFrame]);
  useEffect(() => () => void (quiet.current.timer && clearTimeout(quiet.current.timer)), []);

  const publish = (render: { calls: number; triangles: number }) => {
    const { frames, time } = acc.current;
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    window.__sbl = {
      stats: {
        fps: time > 0 ? frames / time : 0,
        frameMs: frames > 0 ? (time / frames) * 1000 : 0,
        drawCalls: render.calls,
        triangles: render.triangles,
        heapMb: mem ? mem.usedJSHeapSize / 1048576 : 0,
        instances: instances?.() ?? {},
      },
    };
    acc.current = { frames: 0, time: 0 };
  };

  /**
   * A canvas that draws on demand can stop before half a second of frames
   * has added up, which would leave the numbers stale or missing. Once
   * frames go quiet this publishes what the last frame drew, without
   * asking for another frame. After a frame ends the counters hold that
   * frame, so they can be read straight from the renderer.
   */
  const armQuietPublish = () => {
    if (quiet.current.timer) return;
    quiet.current.timer = setTimeout(() => {
      quiet.current.timer = null;
      if (performance.now() - quiet.current.at < 400) armQuietPublish();
      else if (acc.current.frames > 0) publish({ calls: gl.info.render.calls, triangles: gl.info.render.triangles });
    }, 600);
  };

  useFrame((_, dt) => {
    if (wholeFrame) {
      // Runs before this frame renders, so the counters hold the whole previous frame.
      last.current = { calls: gl.info.render.calls, triangles: gl.info.render.triangles };
      gl.info.reset();
    }
    acc.current.frames++;
    acc.current.time += dt;
    quiet.current.at = performance.now();
    if (acc.current.time < 0.5) {
      armQuietPublish();
      return;
    }
    publish(wholeFrame ? last.current : gl.info.render);
  });
  return null;
}
