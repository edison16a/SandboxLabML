'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import type { InputSpec } from '@/engine/env/types';
import { RayBuffer } from '@/render/shared/RayBuffer';
import { useDisposable } from '@/render/shared/useDisposable';
import { useRacingScene } from '@/render/racing/sceneContext';

/** Height of the rays above the road, m, a little over the lab's so they clear the car's nose in a low shot. */
const RAY_HEIGHT = 0.75;

/**
 * The hero car's distance rays, drawn from the very inputs its brain got
 * last tick: green for open road, red as a wall comes close. These are the
 * same numbers that light up the input neurons in the brain panel.
 */
export function HeroCarRays({ schema }: { schema: InputSpec[] }) {
  const { ghosts, frame } = useRacingScene();
  const rays = useMemo(() => schema.filter((s) => s.ray), [schema]);
  const buffer = useDisposable(() => new RayBuffer(Math.max(1, rays.length)), [rays.length]);

  useFrame(() => {
    buffer.begin();
    const inspect = ghosts?.inspect;
    const obs = inspect && inspect.index === 0 ? inspect.obs : null;
    if (obs && frame.focusIndex === 0) {
      const { x, z } = frame.focusPos;
      for (let k = 0; k < rays.length; k++) {
        const spec = rays[k];
        const ray = spec.ray;
        if (!ray) continue;
        const v = obs[spec.index] ?? 1;
        const a = frame.focusYaw + ray.angle;
        const len = v * ray.maxLength;
        buffer.add(x, z, x + Math.cos(a) * len, z - Math.sin(a) * len, RAY_HEIGHT, 1 - v, false, v < 0.999);
      }
    }
    buffer.end();
  });

  // Lines only: from a camera this far up the lab's hit dots read as specks of noise.
  return <primitive object={buffer.lines} />;
}
