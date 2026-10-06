'use client';

import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type { InputSpec } from '@/engine/env/types';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { useRacingLab } from '@/features/racing/state/labStore';
import { RayBuffer } from '@/render/shared/RayBuffer';
import { useDisposable } from '@/render/shared/useDisposable';
import { useRacingScene } from './sceneContext';

const STRIDE = RACING_SNAPSHOT.stride;
const MAX_LABELS = 20;

/**
 * The inputs overlay for Racing, driven entirely by the input schema: it
 * draws every ray input of the inspected car with a distance label, or the
 * rays of every car as lines only.
 */
export function RaysOverlay({ schema }: { schema: InputSpec[] }) {
  const { population, ghosts, frame } = useRacingScene();
  const rays = useMemo(() => schema.filter((s) => s.ray), [schema]);
  const buffer = useDisposable(() => new RayBuffer(256 * Math.max(1, rays.length)), [rays.length]);
  const labels = useRef<Array<HTMLDivElement | null>>([]);
  const anchors = useRef<Array<{ position: { set(x: number, y: number, z: number): void } } | null>>([]);

  useFrame(() => {
    const { inputsOverlay, inputsScope, hoveredInput } = useRacingLab.getState();
    const visible = inputsOverlay && rays.length > 0;
    buffer.lines.visible = buffer.dots.visible = visible;
    labels.current.forEach((l) => l && (l.style.display = 'none'));
    if (!visible) return;
    buffer.begin();
    const y = 0.7;
    const stream = frame.focusStream === 'ghosts' ? ghosts : population;
    if (inputsScope === 'all' && population?.curr && population.rays) {
      const per = population.rays.length / Math.max(1, population.count);
      const buf = population.curr.buffer;
      for (let i = 0; i < population.count; i++) {
        if (buf[i * STRIDE + 6] !== 0) continue;
        const x = buf[i * STRIDE];
        const z = -buf[i * STRIDE + 1];
        const h = buf[i * STRIDE + 2];
        rays.forEach((spec, r) => {
          const v = population.rays![i * per + r] ?? 1;
          const len = v * spec.ray!.maxLength;
          const a = h + spec.ray!.angle;
          buffer.add(x, z, x + Math.cos(a) * len, z - Math.sin(a) * len, y, 1 - v, false, v < 0.999);
        });
      }
    }
    const obs = stream?.inspect && stream.inspect.index === frame.focusIndex ? stream.inspect.obs : null;
    if (obs && frame.focusIndex >= 0) {
      const { x, z } = frame.focusPos;
      rays.forEach((spec, k) => {
        const v = obs[spec.index] ?? 1;
        const len = v * spec.ray!.maxLength;
        const a = frame.focusYaw + spec.ray!.angle;
        const ex = x + Math.cos(a) * len;
        const ez = z - Math.sin(a) * len;
        buffer.add(x, z, ex, ez, y, 1 - v, hoveredInput === spec.index, v < 0.999);
        const anchor = anchors.current[k];
        const label = labels.current[k];
        if (anchor && label && k < MAX_LABELS) {
          anchor.position.set(ex, y + 0.4, ez);
          label.style.display = 'block';
          label.textContent = `${(v * spec.ray!.maxLength).toFixed(1)} m`;
        }
      });
    }
    buffer.end();
  });

  return (
    <group>
      <primitive object={buffer.lines} />
      <primitive object={buffer.dots} />
      {rays.slice(0, MAX_LABELS).map((spec, k) => (
        <group key={spec.key} ref={(el) => void (anchors.current[k] = el)}>
          <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div
              ref={(el) => void (labels.current[k] = el)}
              style={{ display: 'none' }}
              className="rounded bg-black/70 px-1 py-px font-mono text-[10px] whitespace-nowrap text-white"
            />
          </Html>
        </group>
      ))}
    </group>
  );
}
