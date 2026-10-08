'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DEFAULT_CAR } from '@/engine/racing/car/params';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { useRacingLab } from '@/features/racing/state/labStore';
import { attachOpacity, createFadeMaterial } from '@/render/shared/fadeMaterial';
import { blendPose, type Pose } from '@/render/shared/interpolate';
import { useDisposable } from '@/render/shared/useDisposable';
import { crowdGeometry } from './car/geometry/crowd';
import { withCarSurface } from './car/materials/carSurface';
import { apart, atLens, clearance } from './fleet/clearance';
import { FadeSplit } from './fleet/fadeSplit';
import { settle } from './fleet/packView';
import { FleetMotion } from './motion/fleetMotion';
import { ghostColor, ghostOpacity } from './palette';
import { useRacingScene } from './sceneContext';
import { GhostTrails } from './GhostTrails';

const MAX_GHOSTS = 64;

const STRIDE = RACING_SNAPSHOT.stride;

/**
 * Past champions replayed as translucent ghosts in one instanced draw call.
 * Older generations are cooler and fainter; a crashed ghost holds still for
 * a second, then fades, and an older ghost fades out where a newer one
 * drives through it.
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
    () => ({
      m: new THREE.Matrix4(),
      c: new THREE.Color(),
      pose: { x: 0, y: 0, heading: 0 } as Pose,
      poses: new Float32Array(MAX_GHOSTS * 3),
      keep: new Float32Array(MAX_GHOSTS),
      other: new THREE.Vector3(),
      stopAt: new Float64Array(MAX_GHOSTS),
      epoch: -1,
    }),
    [],
  );
  const fleet = useMemo(() => new FleetMotion(MAX_GHOSTS), []);
  // Eases each ghost's clearance over time, as the pack does, so a ghost on the edge of a rule never hangs half gone.
  const clears = useMemo(() => new FadeSplit(MAX_GHOSTS), []);

  useFrame((state, dt) => {
    const m = mesh.current;
    const d = depthMesh.current;
    if (!m || !d) return;
    // Both meshes read the same instance matrices; only the count needs copying.
    if (d.instanceMatrix !== m.instanceMatrix) d.instanceMatrix = m.instanceMatrix;
    const { view, hoveredGhost, run, camera } = useRacingLab.getState();
    // Chase and trackside are about one car: ghosts sitting on top of it thin out so it stays clear.
    const clearFocus = camera === 'chase' || camera === 'trackside';
    if (!ghosts?.curr || view === 'population') {
      m.count = d.count = 0;
      return;
    }
    const restart = tmp.epoch !== ghosts.epoch;
    if (restart) {
      tmp.epoch = ghosts.epoch;
      tmp.stopAt.fill(0);
    }
    clears.begin(Math.min(dt, 1));
    const now = state.clock.elapsedTime;
    const buf = ghosts.curr.buffer;
    const prev = ghosts.prev?.buffer ?? null;
    const a = ghosts.alpha();
    const n = Math.min(ghosts.count, MAX_GHOSTS);
    fleet.update(ghosts, n, run?.racing?.car ?? DEFAULT_CAR, Math.min(dt, 0.1));
    const poses = tmp.poses;
    for (let i = 0; i < n; i++) {
      blendPose(prev, buf, i * STRIDE, a, tmp.pose);
      poses[i * 3] = tmp.pose.x;
      poses[i * 3 + 1] = tmp.pose.y;
      poses[i * 3 + 2] = tmp.pose.heading;
    }
    // Newest first, so an older ghost can give way to a newer one that stays.
    for (let i = n - 1; i >= 0; i--) {
      const t = n > 1 ? i / (n - 1) : 1;
      const stopped = buf[i * STRIDE + 6] !== 0;
      if (stopped && tmp.stopAt[i] === 0) tmp.stopAt[i] = now;
      if (!stopped) tmp.stopAt[i] = 0;
      const since = stopped ? now - tmp.stopAt[i] : 0;
      const fade = since < 1 ? 1 : Math.max(0.12, 1 - (since - 1) / 0.6);
      const hover = hoveredGhost === ghosts.tags[i];
      // A ghost at the lens or driving through the followed car would veil it in every view; chase and trackside clear the line of sight too.
      const gx = poses[i * 3];
      const gz = -poses[i * 3 + 1];
      let clear = clearFocus ? clearance(gx, gz, frame.focusPos, frame.focusYaw, state.camera.position) : atLens(gx, gz, state.camera.position);
      if (!clearFocus && frame.focusIndex >= 0) clear = Math.min(clear, apart(gx, gz, frame.focusPos, frame.focusYaw));
      // Late champions drive one line, and stacked see through shells read as a jumble of panels: the older ghost gives way.
      for (let j = i + 1; j < n; j++) {
        if (tmp.keep[j] < 0.5) continue;
        tmp.other.set(poses[j * 3], 0, -poses[j * 3 + 1]);
        clear = Math.min(clear, apart(gx, gz, tmp.other, poses[j * 3 + 2]));
      }
      clear = clears.place(i, settle(clear, clears.shown[i]), restart);
      const opacity = (hover ? 0.9 : ghostOpacity(t)) * fade * clear;
      tmp.keep[i] = i === frame.hiddenGhost || fade < 0.5 ? 0 : clear;
      // A fully faded ghost is dropped outright, so its depth pass cannot hide smoke or other ghosts behind it.
      fleet.compose(i, poses[i * 3], 0.01, gz, poses[i * 3 + 2], i === frame.hiddenGhost || opacity < 0.02 ? 0 : 1, tmp.m);
      m.setMatrixAt(i, tmp.m);
      ghostColor(t, tmp.c);
      if (hover) tmp.c.set('#ffffff');
      m.setColorAt(i, tmp.c);
      built.opacity.setX(i, opacity);
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
