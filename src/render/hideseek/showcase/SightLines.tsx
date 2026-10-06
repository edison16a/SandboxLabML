'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { bearing } from '@/engine/hideseek/frame';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { FLAG_FROZEN } from '@/engine/hideseek/snapshot';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { agentAt, blendFloorPose, hasFlag, STRIDE } from '../frame/snapshotRead';
import { wallsOfLayout } from '../layout/arenaWalls';
import { sightClear } from '../overlay/sight2d';
import { HS } from '../palette';

const P = DEFAULT_HIDESEEK_PHYSICS;
/** Clear sight lines are pushed past 1 so bloom catches them. */
const CLEAR = HS.sightClear.clone().multiplyScalar(2.2);
const BLOCKED = HS.sightBlocked.clone().multiplyScalar(0.8);

/**
 * The seeker's line of sight to the three points the engine checks on the
 * hider (its center and both shoulders): red where the line is clear, grey
 * where a wall or box blocks it. Drawn only while the hider is inside the
 * seeker's range and field of view, which is when the engine looks at all.
 */
export function SightLines({ arena, layout }: { arena: number; layout: number }) {
  const { frame } = useHsScene();
  const size = useThree((s) => s.size);
  const built = useDisposable(() => {
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(new Float32Array(3 * 6));
    geometry.setColors(new Float32Array(3 * 6));
    const material = new LineMaterial({ linewidth: 2.4, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false });
    const lines = new LineSegments2(geometry, material);
    lines.frustumCulled = false;
    lines.renderOrder = 6;
    lines.raycast = () => {};
    return { lines, geometry, material, dispose: () => (geometry.dispose(), material.dispose()) };
  }, []);
  const state = useMemo(() => ({ s: { x: 0, z: 0, yaw: 0 }, h: { x: 0, z: 0, yaw: 0 } }), []);

  useFrame(() => {
    const curr = frame.curr;
    const { lines, geometry, material } = built;
    material.resolution.set(size.width, size.height);
    lines.visible = false;
    if (!curr) return;
    const so = agentAt(arena, 1);
    if (hasFlag(curr[so + 3], FLAG_FROZEN) || curr[arena * STRIDE + 1] === 1) return;
    blendFloorPose(frame.prev, curr, so, frame.alpha, state.s);
    blendFloorPose(frame.prev, curr, agentAt(arena, 0), frame.alpha, state.h);
    const dx = state.h.x - state.s.x;
    const dz = state.h.z - state.s.z;
    const d = Math.hypot(dx, dz);
    if (d > P.vision.range || d < 1e-3 || Math.abs(bearing(dx, dz, state.s.yaw)) > P.vision.fov / 2) return;
    const start = geometry.attributes.instanceStart as unknown as THREE.InterleavedBufferAttribute;
    const colorStart = geometry.attributes.instanceColorStart as unknown as THREE.InterleavedBufferAttribute;
    const pos = start.data.array as Float32Array;
    const col = colorStart.data.array as Float32Array;
    const walls = wallsOfLayout(layout);
    const y = P.rayHeight;
    const sx = (-dz / d) * P.agent.radius;
    const sz = (dx / d) * P.agent.radius;
    for (let k = 0; k < 3; k++) {
      const side = k === 0 ? 0 : k === 1 ? 1 : -1;
      const tx = state.h.x + sx * side;
      const tz = state.h.z + sz * side;
      const c = sightClear(walls, curr, arena, state.s.x, state.s.z, tx, tz) ? CLEAR : BLOCKED;
      pos[k * 6] = state.s.x;
      pos[k * 6 + 1] = y;
      pos[k * 6 + 2] = state.s.z;
      pos[k * 6 + 3] = tx;
      pos[k * 6 + 4] = y;
      pos[k * 6 + 5] = tz;
      for (let e = 0; e < 2; e++) {
        col[k * 6 + e * 3] = c.r;
        col[k * 6 + e * 3 + 1] = c.g;
        col[k * 6 + e * 3 + 2] = c.b;
      }
    }
    start.data.needsUpdate = true;
    colorStart.data.needsUpdate = true;
    lines.visible = true;
  });

  return <primitive object={built.lines} />;
}
