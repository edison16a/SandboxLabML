'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { FLAG_SEEING, HIDESEEK_RAY_SNAPSHOT, SNAPSHOT_RAYS } from '@/engine/hideseek/snapshot';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';
import { RayBuffer } from '@/render/shared/RayBuffer';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { agentAt, blendFloorPose, hasFlag } from '../frame/snapshotRead';
import { arenaOrigin } from '../layout/gridLattice';
import { MAX_ARENAS } from '../grid/scratch';
import { MAX_RAY_LABELS, RayLabels, type RayLabelsHandle } from './RayLabels';

const Y = DEFAULT_HIDESEEK_PHYSICS.rayHeight;
const RAY_STRIDE = HIDESEEK_RAY_SNAPSHOT.stride;
const CAPACITY = MAX_ARENAS * (2 * SNAPSHOT_RAYS + 1) + 64;

/** Line counts drawn last frame, published with the render stats for tests. */
export const overlayCounts = { rays: 0, sightLines: 0 };

/**
 * Every line the grid needs in one LineSegments buffer: a red sight line in
 * each arena whose seeker sees its hider, and with the inputs overlay on,
 * sensor rays. Rays come from the schema: the inspected agent's rays with a
 * distance label each (hovering an input highlights its ray), or the hit
 * points of every agent in every arena.
 */
export function RaysOverlay() {
  const { frame, schemas } = useHsScene();
  const buffer = useDisposable(() => new RayBuffer(CAPACITY), []);
  const labels = useRef<RayLabelsHandle>(null);
  const rayRange = schemas[0].find((s) => s.ray)?.ray?.maxLength ?? 12;
  const t = useMemo(() => ({ o: { x: 0, z: 0 }, s: { x: 0, z: 0, yaw: 0 }, h: { x: 0, z: 0, yaw: 0 } }), []);

  useFrame(() => {
    const curr = frame.curr;
    labels.current?.hideAll();
    buffer.begin();
    overlayCounts.rays = overlayCounts.sightLines = 0;
    const { inputsOverlay, inputsScope, hoveredInput } = useHideSeekLab.getState();
    if (curr && frame.count > 1) {
      for (let k = 0; k < frame.count; k++) {
        const arena = frame.first + k;
        if (k === frame.focusSlot || !hasFlag(curr[agentAt(arena, 1) + 3], FLAG_SEEING)) continue;
        arenaOrigin(k, frame.lattice, t.o);
        blendFloorPose(frame.prev, curr, agentAt(arena, 1), frame.alpha, t.s);
        blendFloorPose(frame.prev, curr, agentAt(arena, 0), frame.alpha, t.h);
        buffer.add(t.o.x + t.s.x, t.o.z + t.s.z, t.o.x + t.h.x, t.o.z + t.h.z, Y, 1, false, false);
        overlayCounts.sightLines++;
      }
    }
    const feed = frame.feed;
    if (curr && feed && inputsOverlay) {
      const rays = feed.rays;
      if ((inputsScope === 'all' || frame.focusSlot < 0) && rays && rays.length >= (frame.first + frame.count) * RAY_STRIDE) {
        for (let k = 0; k < frame.count; k++) {
          const arena = frame.first + k;
          arenaOrigin(k, frame.lattice, t.o);
          for (let a = 0; a < 2; a++) {
            const o = agentAt(arena, a);
            const ax = curr[o];
            const az = curr[o + 1];
            const base = arena * RAY_STRIDE + a * SNAPSHOT_RAYS * 2;
            for (let r = 0; r < SNAPSHOT_RAYS; r++) {
              const hx = rays[base + 2 * r];
              const hz = rays[base + 2 * r + 1];
              const d = Math.hypot(hx - ax, hz - az);
              if (d < 1e-3) continue;
              buffer.add(t.o.x + ax, t.o.z + az, t.o.x + hx, t.o.z + hz, Y, 1 - d / rayRange, false, d < rayRange - 0.02);
              overlayCounts.rays++;
            }
          }
        }
      }
      const inspect = feed.inspect;
      const arena = inspect ? inspect.index >> 1 : -1;
      const slot = arena - frame.first;
      if (inspect && slot >= 0 && slot < frame.count) {
        const agent = inspect.index & 1;
        arenaOrigin(slot, frame.lattice, t.o);
        blendFloorPose(frame.prev, curr, agentAt(arena, agent), frame.alpha, t.s);
        const x = t.o.x + t.s.x;
        const z = t.o.z + t.s.z;
        let label = 0;
        for (const spec of schemas[agent]) {
          if (!spec.ray) continue;
          const v = Math.min(1, Math.max(0, inspect.obs[spec.index] ?? 1));
          const len = v * spec.ray.maxLength;
          const ang = t.s.yaw + spec.ray.angle;
          const ex = x + Math.cos(ang) * len;
          const ez = z - Math.sin(ang) * len;
          buffer.add(x, z, ex, ez, Y, 1 - v, hoveredInput === spec.index, v < 0.999);
          overlayCounts.rays++;
          if (label < MAX_RAY_LABELS) labels.current?.show(label++, ex, Y + 0.45, ez, `${len.toFixed(1)} m`);
        }
      }
    }
    buffer.end();
    buffer.lines.visible = buffer.dots.visible = overlayCounts.rays + overlayCounts.sightLines > 0;
  });

  return (
    <group>
      <primitive object={buffer.lines} />
      <primitive object={buffer.dots} />
      <RayLabels ref={labels} />
    </group>
  );
}
