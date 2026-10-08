'use client';

import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { DEFAULT_CAR } from '@/engine/racing/car/params';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { useRacingLab, type QualityTier } from '@/features/racing/state/labStore';
import { attachOpacity, withInstanceOpacity } from '@/render/shared/fadeMaterial';
import { blendPose, type Pose } from '@/render/shared/interpolate';
import { useDisposable } from '@/render/shared/useDisposable';
import { crowdGeometry } from './car/geometry/crowd';
import { withCarSurface } from './car/materials/carSurface';
import { useCarReflections } from './car/materials/useCarReflections';
import { apart, atLens, clearance } from './fleet/clearance';
import { FadeSplit } from './fleet/fadeSplit';
import { FleetMotion } from './motion/fleetMotion';
import { CRASHED_COLOR, speciesColor } from './palette';
import { useRacingScene } from './sceneContext';

const MAX_CARS = 256;
const STRIDE = RACING_SNAPSHOT.stride;
/** Cars within this many meters of the followed car may cast into the sun's shadow box. */
const SHADOW_REACH = 100;

/**
 * True when car i sits within a meter of a car listed before it. Clones
 * on the grid, or late generations driving one line, would otherwise draw
 * the same body twice and flicker in stripes of both colors; the later
 * one fades out until the two part.
 */
function overlapsEarlier(poses: Float32Array, i: number): boolean {
  const x = poses[i * 3];
  const y = poses[i * 3 + 1];
  for (let j = 0; j < i; j++) if ((poses[j * 3] - x) ** 2 + (poses[j * 3 + 1] - y) ** 2 < 1) return true;
  return false;
}

/** The crowd car's paint: a clear coat on High, cheaper standard shading below. */
function carMaterial(tier: QualityTier): THREE.MeshStandardMaterial {
  return tier === 'high'
    ? new THREE.MeshPhysicalMaterial({ vertexColors: true, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.85 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, envMapIntensity: 0.85 });
}

/**
 * The live generation, up to 256 cars in one instanced draw call, each a
 * lighter build of the hero car. The paint takes the species color;
 * stopped cars turn graphite and sink slightly so the ones still driving
 * stand out. Every body pitches, rolls and slides on its own springs from
 * its own accelerations, and a car on top of another fades out until they
 * part. In the chase and trackside views, cars at the
 * lens or between it and the followed car melt away: they move to a small
 * transparent pass whose opacity eases over time, with a depth pass first
 * so each pixel shows only a fading car's nearest surface.
 */
export function PopulationCars({ castShadow }: { castShadow: boolean }) {
  const { population, frame } = useRacingScene();
  const tier = useRacingLab((s) => s.activeTier);
  const solid = useRef<THREE.InstancedMesh>(null);
  const rest = useRef<THREE.InstancedMesh>(null);
  const fading = useRef<THREE.InstancedMesh>(null);
  const depth = useRef<THREE.InstancedMesh>(null);
  const shape = useDisposable(() => {
    const geometry = crowdGeometry();
    return { geometry, opacity: attachOpacity(geometry, MAX_CARS), dispose: () => geometry.dispose() };
  }, []);
  const look = useDisposable(() => {
    const body = withCarSurface(carMaterial(tier));
    const fade = withCarSurface(withInstanceOpacity(carMaterial(tier)));
    fade.depthFunc = THREE.LessEqualDepth;
    // Transparent so it draws after the opaque scene; drawn earlier it would punch holes in the track behind it.
    const prepass = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true });
    return { body, fade, prepass, dispose: () => [body, fade, prepass].forEach((m) => m.dispose()) };
  }, [tier]);
  useCarReflections([look.body, look.fade]);
  const fleet = useMemo(() => new FleetMotion(MAX_CARS), []);
  const split = useMemo(() => new FadeSplit(MAX_CARS), []);
  const tmp = useMemo(
    () => ({ m: new THREE.Matrix4(), c: new THREE.Color(), pose: { x: 0, y: 0, heading: 0 } as Pose, poses: new Float32Array(MAX_CARS * 3), epoch: -1, casters: new Int32Array(MAX_CARS), others: new Int32Array(MAX_CARS) }),
    [],
  );

  useFrame((state, dt) => {
    const a = solid.current;
    const r = rest.current;
    const f = fading.current;
    const d = depth.current;
    if (!a || !r || !f || !d) return;
    // The depth pass reads the fading cars' matrices; only the count needs copying.
    if (d.instanceMatrix !== f.instanceMatrix) d.instanceMatrix = f.instanceMatrix;
    const { view, camera, run } = useRacingLab.getState();
    if (!population?.curr || view === 'overlay') {
      a.count = r.count = f.count = d.count = 0;
      return;
    }
    // The chase and trackside views are about one car: clear the pack off it there.
    const clearFocus = camera === 'chase' || camera === 'trackside';
    const step = Math.min(dt, 0.1);
    const buf = population.curr.buffer;
    const prev = population.prev?.buffer ?? null;
    const alpha = population.alpha();
    const n = Math.min(population.count, MAX_CARS);
    fleet.update(population, n, run?.racing?.car ?? DEFAULT_CAR, step);
    const poses = tmp.poses;
    for (let i = 0; i < n; i++) {
      blendPose(prev, buf, i * STRIDE, alpha, tmp.pose);
      poses[i * 3] = tmp.pose.x;
      poses[i * 3 + 1] = tmp.pose.y;
      poses[i * 3 + 2] = tmp.pose.heading;
    }
    // Fades follow real time even when frames are slow, so a weak GPU never shows a car half gone for long.
    split.begin(Math.min(dt, 1));
    // A new episode puts every car back on the grid at once: no easing then, or the copies on the grid would linger over the followed car.
    const restart = population.epoch !== tmp.epoch;
    tmp.epoch = population.epoch;
    let casters = 0;
    let others = 0;
    for (let i = 0; i < n; i++) {
      const x = poses[i * 3];
      const y = poses[i * 3 + 1];
      const hidden = i === frame.hiddenPopulation;
      // In every view a car at the lens or overlapping the detailed followed car fades; chase and trackside also clear the line of sight.
      const cam = state.camera.position;
      let target = hidden ? 0 : clearFocus ? clearance(x, -y, frame.focusPos, frame.focusYaw, cam) : atLens(x, -y, cam);
      if (!clearFocus && frame.focusIndex >= 0) target = Math.min(target, apart(x, -y, frame.focusPos, frame.focusYaw));
      // A car on top of an earlier one would draw the same body twice.
      if (target > 0 && overlapsEarlier(poses, i)) target = 0;
      const solidBefore = split.solidCount;
      const fadeBefore = split.fadeCount;
      const opacity = split.place(i, target, hidden || restart);
      let mesh: THREE.InstancedMesh | null = split.solidCount > solidBefore ? a : split.fadeCount > fadeBefore ? f : null;
      if (!mesh) continue;
      let slot = fadeBefore;
      if (mesh === a) {
        // Only cars near the sun's shadow box, which follows the followed car, go through the shadow pass.
        const near = castShadow && (x - frame.focusPos.x) ** 2 + (y + frame.focusPos.z) ** 2 < SHADOW_REACH * SHADOW_REACH;
        mesh = near ? a : r;
        slot = near ? casters : others;
        (near ? tmp.casters : tmp.others)[slot] = i;
        if (near) casters++;
        else others++;
      }
      const status = buf[i * STRIDE + 6];
      fleet.compose(i, x, status === 0 ? 0 : -0.06, -y, poses[i * 3 + 2], 1, tmp.m);
      mesh.setMatrixAt(slot, tmp.m);
      if (status === 0) speciesColor(population.tags[i] ?? 0, tmp.c);
      else tmp.c.copy(CRASHED_COLOR);
      mesh.setColorAt(slot, tmp.c);
      if (mesh === f) shape.opacity.setX(slot, opacity);
    }
    a.count = casters;
    r.count = others;
    f.count = d.count = split.fadeCount;
    a.instanceMatrix.needsUpdate = r.instanceMatrix.needsUpdate = f.instanceMatrix.needsUpdate = true;
    if (a.instanceColor) a.instanceColor.needsUpdate = true;
    if (r.instanceColor) r.instanceColor.needsUpdate = true;
    if (f.instanceColor) f.instanceColor.needsUpdate = true;
    shape.opacity.needsUpdate = true;
  });

  // Clicking a car follows it; the draw slot maps back to the car through the split's lists.
  const follow = (list: Int32Array) => (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.instanceId !== undefined) useRacingLab.getState().set({ focus: { kind: 'car', index: list[e.instanceId] } });
  };
  return (
    <group>
      <instancedMesh ref={solid} args={[shape.geometry, look.body, MAX_CARS]} castShadow={castShadow} receiveShadow frustumCulled={false} onClick={follow(tmp.casters)} />
      <instancedMesh ref={rest} args={[shape.geometry, look.body, MAX_CARS]} receiveShadow frustumCulled={false} onClick={follow(tmp.others)} />
      <instancedMesh ref={depth} args={[shape.geometry, look.prepass, MAX_CARS]} frustumCulled={false} renderOrder={1} raycast={() => null} />
      <instancedMesh ref={fading} args={[shape.geometry, look.fade, MAX_CARS]} receiveShadow frustumCulled={false} renderOrder={2} onClick={follow(split.fading)} />
    </group>
  );
}
