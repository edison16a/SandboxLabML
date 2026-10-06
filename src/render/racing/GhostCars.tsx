'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { useRacingLab } from '@/features/racing/state/labStore';
import { attachOpacity, createFadeMaterial } from '@/render/shared/fadeMaterial';
import { blendPose, type Pose } from '@/render/shared/interpolate';
import { useDisposable } from '@/render/shared/useDisposable';
import { mergedCarGeometry } from './carGeometry';
import { ghostColor, ghostOpacity } from './palette';
import { useRacingScene } from './sceneContext';
import { GhostTrails } from './GhostTrails';

const MAX_GHOSTS = 64;
const STRIDE = RACING_SNAPSHOT.stride;

/**
 * Past champions replayed as translucent ghosts in one instanced draw call.
 * Older generations are cooler and fainter; a crashed ghost holds still for
 * a second, then fades.
 */
export function GhostCars() {
  const { ghosts, frame } = useRacingScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const built = useDisposable(() => {
    const geometry = mergedCarGeometry();
    const opacity = attachOpacity(geometry, MAX_GHOSTS);
    const material = createFadeMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2 });
    return { geometry, opacity, material, dispose: () => (geometry.dispose(), material.dispose()) };
  }, []);
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), up: new THREE.Vector3(0, 1, 0), pose: { x: 0, y: 0, heading: 0 } as Pose, stopAt: new Float64Array(MAX_GHOSTS), epoch: -1 }),
    [],
  );

  useFrame((state) => {
    const m = mesh.current;
    if (!m) return;
    const { view, hoveredGhost } = useRacingLab.getState();
    if (!ghosts?.curr || view === 'population') {
      m.count = 0;
      return;
    }
    if (tmp.epoch !== ghosts.epoch) {
      tmp.epoch = ghosts.epoch;
      tmp.stopAt.fill(0);
    }
    const now = state.clock.elapsedTime;
    const buf = ghosts.curr.buffer;
    const prev = ghosts.prev?.buffer ?? null;
    const a = ghosts.alpha();
    const n = Math.min(ghosts.count, MAX_GHOSTS);
    for (let i = 0; i < n; i++) {
      const t = n > 1 ? i / (n - 1) : 1;
      blendPose(prev, buf, i * STRIDE, a, tmp.pose);
      const stopped = buf[i * STRIDE + 6] !== 0;
      if (stopped && tmp.stopAt[i] === 0) tmp.stopAt[i] = now;
      if (!stopped) tmp.stopAt[i] = 0;
      const since = stopped ? now - tmp.stopAt[i] : 0;
      const fade = since < 1 ? 1 : Math.max(0.12, 1 - (since - 1) / 0.6);
      const hover = hoveredGhost === ghosts.tags[i];
      tmp.q.setFromAxisAngle(tmp.up, tmp.pose.heading);
      tmp.p.set(tmp.pose.x, 0.01, -tmp.pose.y);
      tmp.s.setScalar(i === frame.hiddenGhost ? 0 : 1);
      tmp.m.compose(tmp.p, tmp.q, tmp.s);
      m.setMatrixAt(i, tmp.m);
      ghostColor(t, tmp.c);
      if (hover) tmp.c.set('#ffffff');
      m.setColorAt(i, tmp.c);
      built.opacity.setX(i, (hover ? 0.9 : ghostOpacity(t)) * fade);
    }
    m.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    built.opacity.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh
        ref={mesh}
        args={[built.geometry, built.material, MAX_GHOSTS]}
        frustumCulled={false}
        renderOrder={2}
        onPointerMove={(e) => {
          e.stopPropagation();
          const gen = e.instanceId !== undefined ? ghosts?.tags[e.instanceId] : undefined;
          if (gen !== undefined && useRacingLab.getState().hoveredGhost !== gen) useRacingLab.getState().set({ hoveredGhost: gen });
        }}
        onPointerOut={() => useRacingLab.getState().set({ hoveredGhost: null })}
        onClick={(e) => {
          e.stopPropagation();
          const gen = e.instanceId !== undefined ? ghosts?.tags[e.instanceId] : undefined;
          if (gen !== undefined) useRacingLab.getState().set({ focus: { kind: 'ghost', generation: gen } });
        }}
      />
      <GhostTrails />
    </group>
  );
}
