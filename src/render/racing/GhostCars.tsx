'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { useRacingLab } from '@/features/racing/state/labStore';
import { attachOpacity, createFadeMaterial } from '@/render/shared/fadeMaterial';
import { blendPose, type Pose } from '@/render/shared/interpolate';
import { useDisposable } from '@/render/shared/useDisposable';
import { crowdGeometry } from './car/geometry/crowd';
import { withCarSurface } from './car/materials/carSurface';
import { ghostColor, ghostOpacity } from './palette';
import { useRacingScene } from './sceneContext';
import { GhostTrails } from './GhostTrails';

const MAX_GHOSTS = 64;
const STRIDE = RACING_SNAPSHOT.stride;

/**
 * Past champions replayed as translucent ghosts in one instanced draw call.
 * Older generations are cooler and fainter; a crashed ghost holds still for
 * a second, then fades.
 *
 * A depth only pass draws first, so each pixel keeps just the nearest ghost
 * surface. Without it every wheel, seat of glass and car behind shows
 * through, and a pack of ghosts on the start line turns to mud.
 */
export function GhostCars() {
  const { ghosts, frame } = useRacingScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const depthMesh = useRef<THREE.InstancedMesh>(null);
  const built = useDisposable(() => {
    const geometry = crowdGeometry();
    const opacity = attachOpacity(geometry, MAX_GHOSTS);
    const material = withCarSurface(createFadeMaterial({ vertexColors: true, depthFunc: THREE.LessEqualDepth }), { ghost: true });
    // Transparent so it draws after the opaque scene; drawn earlier it would punch holes in the track behind it.
    const depth = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true });
    return { geometry, opacity, material, depth, dispose: () => (geometry.dispose(), material.dispose(), depth.dispose()) };
  }, []);
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(), c: new THREE.Color(), up: new THREE.Vector3(0, 1, 0), pose: { x: 0, y: 0, heading: 0 } as Pose, stopAt: new Float64Array(MAX_GHOSTS), epoch: -1 }),
    [],
  );

  useFrame((state) => {
    const m = mesh.current;
    const d = depthMesh.current;
    if (!m || !d) return;
    // Both meshes read the same instance matrices; only the count needs copying.
    if (d.instanceMatrix !== m.instanceMatrix) d.instanceMatrix = m.instanceMatrix;
    const { view, hoveredGhost } = useRacingLab.getState();
    if (!ghosts?.curr || view === 'population') {
      m.count = d.count = 0;
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
    m.count = d.count = n;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    built.opacity.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={depthMesh} args={[built.geometry, built.depth, MAX_GHOSTS]} frustumCulled={false} renderOrder={1} raycast={() => null} />
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
