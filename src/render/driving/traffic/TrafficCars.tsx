'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { CAR_KINDS, CAR_TAXI, MAX_TRAFFIC, type WorldState } from '@/engine/driving/world/state';
import { attachOpacity, withInstanceOpacity } from '@/render/shared/fadeMaterial';
import { useDisposable } from '@/render/shared/useDisposable';
import { useDrivingScene } from '../frame/sceneContext';
import { FadeSplit } from '../population/fadeSplit';
import { detailTier } from '../quality';
import { BODY } from '../suv/dimensions';
import { withCarSurface } from '../suv/materials/carSurface';
import { useCarReflections } from '../suv/materials/useCarReflections';
import { carBodyGeometry } from './carGeometry';
import { TAXI_PAINT, TRAFFIC_PAINTS } from './looks';
import { CAR_SHAPES } from './shapes';
import { createTrafficMaterial } from './trafficMaterial';
import { trafficWheelGeometry } from './wheelGeometry';
import { placeWheels, TrafficMotion, WHEEL_BUILT } from './trafficMotion';

/** Marks one instanced mesh's per frame buffers for upload. */
function finish(mesh: THREE.InstancedMesh | null, count: number): void {
  if (!mesh) return;
  mesh.count = count;
  mesh.instanceMatrix.needsUpdate = true;
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  (mesh.geometry.attributes.aFlags as THREE.InstancedBufferAttribute).needsUpdate = true;
}

/** Half the followed SUV's footprint, padded a little so a car about to touch it already starts to fade, m. */
const FOCUS_HALF = { l: BODY.length / 2 + 0.3, w: BODY.width / 2 + 0.2 };

/** Whether traffic car i's footprint overlaps the followed SUV's (separating axes on both boxes). */
function overlapsFocus(world: WorldState, i: number, x: number, y: number, heading: number): boolean {
  const dx = world.carX[i] - x;
  const dy = world.carY[i] - y;
  if (dx * dx + dy * dy > 49) return false;
  const ca = Math.cos(heading);
  const sa = Math.sin(heading);
  const cb = Math.cos(world.carHeading[i]);
  const sb = Math.sin(world.carHeading[i]);
  const bl = world.carLength[i] / 2;
  const bw = world.carWidth[i] / 2;
  for (let k = 0; k < 4; k++) {
    const ux = k === 0 ? ca : k === 1 ? -sa : k === 2 ? cb : -sb;
    const uy = k === 0 ? sa : k === 1 ? ca : k === 2 ? sb : cb;
    const ra = FOCUS_HALF.l * Math.abs(ca * ux + sa * uy) + FOCUS_HALF.w * Math.abs(-sa * ux + ca * uy);
    const rb = bl * Math.abs(cb * ux + sb * uy) + bw * Math.abs(-sb * ux + cb * uy);
    if (Math.abs(dx * ux + dy * uy) > ra + rb) return false;
  }
  return true;
}

/**
 * The city's other cars: one instanced draw call per body type plus one
 * for every wheel. Paint is picked per car and stays with it; brake lights,
 * indicators and rolling wheels come from the world snapshot. Traffic
 * cannot see the learners, so a car that rolls into the followed SUV
 * (waiting at a light, say) melts to a ghost while the two overlap rather
 * than cut through it.
 */
export function TrafficCars() {
  const { frame, tier } = useDrivingScene();
  const d = detailTier(tier);
  const time = useMemo(() => ({ value: 0 }), []);
  const solid = useRef<Array<THREE.InstancedMesh | null>>([]);
  const fading = useRef<Array<THREE.InstancedMesh | null>>([]);
  const wheels = useRef<THREE.InstancedMesh>(null);
  const built = useDisposable(() => {
    const count = d === 'high' ? 40 : d === 'medium' ? 28 : 18;
    const steps = d === 'low' ? 1 : 2;
    const bodies = Array.from({ length: CAR_KINDS }, (_, k) => {
      const geometry = carBodyGeometry(CAR_SHAPES[k], count, steps);
      geometry.setAttribute('aFlags', new THREE.InstancedBufferAttribute(new Float32Array(MAX_TRAFFIC), 1).setUsage(THREE.DynamicDrawUsage));
      const fadeGeometry = geometry.clone();
      fadeGeometry.setAttribute('aFlags', new THREE.InstancedBufferAttribute(new Float32Array(MAX_TRAFFIC), 1).setUsage(THREE.DynamicDrawUsage));
      return { geometry, fadeGeometry, opacity: attachOpacity(fadeGeometry, MAX_TRAFFIC) };
    });
    const wheel = trafficWheelGeometry(WHEEL_BUILT, d === 'low' ? 10 : 16);
    const body = createTrafficMaterial(time);
    const ghost = withInstanceOpacity(createTrafficMaterial(time));
    const wheelMat = withCarSurface(new THREE.MeshStandardMaterial({ vertexColors: true }));
    const all = [...bodies.flatMap((b) => [b.geometry, b.fadeGeometry]), wheel, body, ghost, wheelMat];
    return { bodies, wheel, body, ghost, wheelMat, dispose: () => all.forEach((x) => x.dispose()) };
  }, [d, time]);
  useCarReflections([built.body, built.ghost, built.wheelMat]);
  const motion = useMemo(() => new TrafficMotion(), []);
  const split = useMemo(() => new FadeSplit(MAX_TRAFFIC), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color(), counts: new Int32Array(CAR_KINDS), fades: new Int32Array(CAR_KINDS) }), []);

  useFrame((_, dt) => {
    const world = frame.world;
    const w = wheels.current;
    time.value += Math.min(dt, 0.1);
    if (!world || !w) return;
    motion.update(world, Math.min(dt, 0.1));
    tmp.counts.fill(0);
    tmp.fades.fill(0);
    split.begin(Math.min(dt, 1));
    let wheelCount = 0;
    for (let i = 0; i < world.carCount; i++) {
      const k = world.carKind[i];
      const near = frame.focus >= 0 && overlapsFocus(world, i, frame.pos.x, -frame.pos.z, frame.yaw);
      const before = split.solidCount;
      const opacity = split.place(i, near ? 0.28 : 1);
      const isSolid = split.solidCount > before;
      const mesh = isSolid ? solid.current[k] : fading.current[k];
      if (!mesh) continue;
      const slot = isSolid ? tmp.counts[k]++ : tmp.fades[k]++;
      motion.compose(i, world, tmp.m);
      mesh.setMatrixAt(slot, tmp.m);
      tmp.c.copy(k === CAR_TAXI ? TAXI_PAINT : TRAFFIC_PAINTS[(i * 7 + 3) % TRAFFIC_PAINTS.length]);
      mesh.setColorAt(slot, tmp.c);
      const geo = isSolid ? built.bodies[k].geometry : built.bodies[k].fadeGeometry;
      (geo.attributes.aFlags as THREE.InstancedBufferAttribute).setX(slot, world.carFlags[i]);
      if (!isSolid) built.bodies[k].opacity.setX(slot, opacity);
      if (isSolid) wheelCount = placeWheels(motion, i, world, tmp.m, w, wheelCount);
    }
    for (let k = 0; k < CAR_KINDS; k++) {
      finish(solid.current[k], tmp.counts[k]);
      finish(fading.current[k], tmp.fades[k]);
      built.bodies[k].opacity.needsUpdate = true;
    }
    w.count = wheelCount;
    w.instanceMatrix.needsUpdate = true;
  });

  const shadows = tier !== 'low';
  return (
    <group>
      {built.bodies.map((b, k) => (
        <group key={k}>
          <instancedMesh ref={(el) => void (solid.current[k] = el)} args={[b.geometry, built.body, MAX_TRAFFIC]} castShadow={shadows} receiveShadow frustumCulled={false} />
          <instancedMesh ref={(el) => void (fading.current[k] = el)} args={[b.fadeGeometry, built.ghost, MAX_TRAFFIC]} frustumCulled={false} renderOrder={2} />
        </group>
      ))}
      <instancedMesh ref={wheels} args={[built.wheel, built.wheelMat, MAX_TRAFFIC * 4]} castShadow={shadows} receiveShadow frustumCulled={false} />
    </group>
  );
}
