'use client';

import { Html } from '@react-three/drei';
import { useImperativeHandle, useRef, type Ref } from 'react';

/** Most ray labels drawn at once: the 16 rays of the standard brain. */
export const MAX_RAY_LABELS = 16;

/** Moves and fills ray labels from inside a frame loop, without React re-renders. */
export interface RayLabelsHandle {
  hideAll(): void;
  show(k: number, x: number, y: number, z: number, text: string): void;
}

/**
 * A pool of DOM labels for the inspected agent's rays, each showing the
 * distance its ray reads. Positions and text are written straight to the
 * DOM by the overlay's frame loop.
 */
export function RayLabels({ ref }: { ref: Ref<RayLabelsHandle> }) {
  const anchors = useRef<Array<{ position: { set(x: number, y: number, z: number): void } } | null>>([]);
  const labels = useRef<Array<HTMLDivElement | null>>([]);
  useImperativeHandle(ref, () => ({
    hideAll() {
      for (const l of labels.current) if (l && l.style.display !== 'none') l.style.display = 'none';
    },
    show(k, x, y, z, text) {
      const anchor = anchors.current[k];
      const label = labels.current[k];
      if (!anchor || !label) return;
      anchor.position.set(x, y, z);
      label.style.display = 'block';
      if (label.textContent !== text) label.textContent = text;
    },
  }));
  return (
    <group>
      {Array.from({ length: MAX_RAY_LABELS }, (_, k) => (
        <group key={k} ref={(el) => void (anchors.current[k] = el)}>
          <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
            <div ref={(el) => void (labels.current[k] = el)} style={{ display: 'none' }} className="rounded bg-black/70 px-1 py-px font-mono text-[10px] whitespace-nowrap text-white" />
          </Html>
        </group>
      ))}
    </group>
  );
}
