'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { AGENT_X, AGENT_Z, FLAG_FROZEN, FLAG_SEEING, HIDESEEK_RAY_SNAPSHOT, SNAPSHOT_RAYS } from '@/engine/hideseek/snapshot';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';
import { RayBuffer } from '@/render/shared/RayBuffer';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { followedAgent } from '../frame/followedAgent';
import { agentAt, agentElevation, agentFlags, blendAgentPose, hasFlag } from '../frame/snapshotRead';
import { arenaOrigin } from '../layout/gridLattice';
import { MAX_ARENAS } from '../grid/scratch';
import { HS_COLORS } from '../palette';
import { sandboxFrame } from '../sandbox/sandboxRead';
import { LabelSpacing } from './labelSpacing';
import { arenaHitColor, sandboxHitColor } from './rayHits';
import { MAX_RAY_LABELS, RayLabels, type RayLabelsHandle } from './RayLabels';

const Y = DEFAULT_HIDESEEK_PHYSICS.rayHeight;
const RAY_STRIDE = HIDESEEK_RAY_SNAPSHOT.stride;
const CAPACITY = MAX_ARENAS * (2 * SNAPSHOT_RAYS + 1) + 64;
/** Nearest two distance chips may sit on screen, px: about one chip's width. */
const CHIP_GAP = 40;

/** Line counts drawn last frame, published with the render stats for tests. */
export const overlayCounts = { rays: 0, sightLines: 0 };

/**
 * Every line the grid needs in one LineSegments buffer: a red sight line in
 * each arena whose seeker sees its hider, and with the inputs overlay on,
 * sensor rays. Rays come from the schema: the inspected agent's rays with a
 * distance label each (hovering an input highlights its ray), or the hit
 * points of every agent in every arena. Rays run at sight height over the
 * agent's feet, so they rise up a ramp with it, and a ray that ends on a
 * box, a ramp or an agent ends in a dot of that thing's color.
 */
export function RaysOverlay() {
  const { frame, schemas } = useHsScene();
  const buffer = useDisposable(() => new RayBuffer(CAPACITY, HS_COLORS.rayHighlight), []);
  const labels = useRef<RayLabelsHandle>(null);
  const rayRange = schemas[0].find((s) => s.ray)?.ray?.maxLength ?? 12;
  const t = useMemo(() => ({ o: { x: 0, z: 0 }, s: { x: 0, z: 0, yaw: 0, elevation: 0 }, h: { x: 0, z: 0, yaw: 0, elevation: 0 }, chip: new THREE.Vector3(), spacing: new LabelSpacing(MAX_RAY_LABELS, CHIP_GAP) }), []);

  useFrame(({ camera, size }) => {
    const curr = frame.curr;
    labels.current?.hideAll();
    t.spacing.clear();
    buffer.begin();
    overlayCounts.rays = overlayCounts.sightLines = 0;
    const { inputsOverlay, inputsScope, hoveredInput } = useHideSeekLab.getState();
    if (curr && frame.count > 1) {
      for (let k = 0; k < frame.count; k++) {
        const arena = frame.first + k;
        if (k === frame.focusSlot || !hasFlag(agentFlags(curr, agentAt(arena, 1)), FLAG_SEEING)) continue;
        arenaOrigin(k, frame.lattice, t.o);
        blendAgentPose(frame.prev, curr, agentAt(arena, 1), frame.alpha, t.s);
        blendAgentPose(frame.prev, curr, agentAt(arena, 0), frame.alpha, t.h);
        buffer.add(t.o.x + t.s.x, t.o.z + t.s.z, t.o.x + t.h.x, t.o.z + t.h.z, Y + t.s.elevation, 1, false, false, Y + t.h.elevation);
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
            // A frozen seeker is blind: its rays read full range straight through walls, which says nothing.
            if (hasFlag(agentFlags(curr, o), FLAG_FROZEN)) continue;
            const ax = curr[o + AGENT_X];
            const az = curr[o + AGENT_Z];
            const y = Y + agentElevation(curr, o);
            const base = arena * RAY_STRIDE + a * SNAPSHOT_RAYS * 2;
            for (let r = 0; r < SNAPSHOT_RAYS; r++) {
              const hx = rays[base + 2 * r];
              const hz = rays[base + 2 * r + 1];
              const d = Math.hypot(hx - ax, hz - az);
              if (d < 1e-3) continue;
              const hit = d < rayRange - 0.02;
              buffer.add(t.o.x + ax, t.o.z + az, t.o.x + hx, t.o.z + hz, y, 1 - d / rayRange, false, hit);
              const color = hit ? arenaHitColor(curr, arena, a, hx, hz) : null;
              if (color) buffer.tintDot(color);
              overlayCounts.rays++;
            }
          }
        }
      }
      const inspect = feed.inspect;
      const arena = inspect ? inspect.index >> 1 : -1;
      const slot = arena - frame.first;
      const agent = inspect ? inspect.index & 1 : 0;
      const flags = inspect && slot >= 0 && slot < frame.count ? followedAgent(frame, slot, agent, t.s) : -1;
      if (inspect && flags >= 0 && !hasFlag(flags, FLAG_FROZEN)) {
        arenaOrigin(slot, frame.lattice, t.o);
        const x = t.o.x + t.s.x;
        const z = t.o.z + t.s.z;
        const y = Y + t.s.elevation;
        // The Sandbox stream is not laid out as arenas, so its hits are read from its own frame.
        const sandbox = frame.agentPose ? sandboxFrame(frame) : null;
        // Distance labels only where they can be read: on the arena in the showcase.
        let label = slot === frame.focusSlot ? 0 : MAX_RAY_LABELS;
        const schema = schemas[agent];
        for (let i = 0; i < schema.length; i++) {
          const spec = schema[i];
          if (!spec.ray) continue;
          const v = Math.min(1, Math.max(0, inspect.obs[spec.index] ?? 1));
          const len = v * spec.ray.maxLength;
          const ang = t.s.yaw + spec.ray.angle;
          const ex = x + Math.cos(ang) * len;
          const ez = z - Math.sin(ang) * len;
          const hit = v < 0.999;
          buffer.add(x, z, ex, ez, y, 1 - v, hoveredInput === spec.index, hit);
          const color = !hit ? null : sandbox ? sandboxHitColor(sandbox, agent, ex - t.o.x, ez - t.o.z) : frame.agentPose ? null : arenaHitColor(curr, arena, agent, ex - t.o.x, ez - t.o.z);
          if (color && hoveredInput !== spec.index) buffer.tintDot(color);
          overlayCounts.rays++;
          if (label < MAX_RAY_LABELS) {
            // A chip that would sit on top of another one is left out, so the ones shown stay readable.
            const p = t.chip.set(ex, y + 0.45, ez).project(camera);
            if (p.z < 1 && t.spacing.claim(((p.x + 1) / 2) * size.width, ((1 - p.y) / 2) * size.height)) labels.current?.show(label++, ex, y + 0.45, ez, `${len.toFixed(1)} m`);
          }
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
