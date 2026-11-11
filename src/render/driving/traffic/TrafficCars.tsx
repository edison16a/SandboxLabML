'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { CAR_KINDS, CAR_TAXI, MAX_TRAFFIC } from '@/engine/driving/world/state';
import { attachOpacity, withInstanceOpacity } from '@/render/shared/fadeMaterial';
import { useDisposable } from '@/render/shared/useDisposable';
import { useDrivingScene } from '../frame/sceneContext';
import { FadeSplit } from '../population/fadeSplit';
import { detailTier } from '../quality';
import { withCarSurface } from '../suv/materials/carSurface';
import { useCarReflections } from '../suv/materials/useCarReflections';
import { carBodyGeometry } from './carGeometry';
import { TAXI_PAINT, TRAFFIC_PAINTS } from './looks';
import { CAR_SHAPES } from './shapes';
import { overlapsFocus } from './focusOverlap';
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

/**
 * The city's other cars: one instanced draw call per body type plus one
 * for every wheel. Paint is picked per car and stays with it; brake lights,
 * indicators and rolling wheels come from the world snapshot. Traffic
 * cannot see the learners, so a car that rolls into the followed SUV
 * (waiting at a light, say) melts to a ghost, wheels and all, while the
 * two overlap rather than cut through it.
 */
export function TrafficCars() {
  const { frame, tier } = useDrivingScene();
  const d = detailTier(tier);
  const time = useMemo(() => ({ value: 0 }), []);
  const solid = useRef<Array<THREE.InstancedMesh | null>>([]);
  const fading = useRef<Array<THREE.InstancedMesh | null>>([]);
  const wheels = useRef<THREE.InstancedMesh>(null);
  const fadingWheels = useRef<THREE.InstancedMesh>(null);
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
    // Fading cars keep their wheels: a second wheel mesh that fades with them.
    const fadeWheel = wheel.clone();
    const wheelOpacity = attachOpacity(fadeWheel, MAX_TRAFFIC * 4);
    const body = createTrafficMaterial(time);
    const ghost = withInstanceOpacity(createTrafficMaterial(time));
    const wheelMat = withCarSurface(new THREE.MeshStandardMaterial({ vertexColors: true }));
    const ghostWheelMat = withInstanceOpacity(withCarSurface(new THREE.MeshStandardMaterial({ vertexColors: true })));
    const all = [...bodies.flatMap((b) => [b.geometry, b.fadeGeometry]), wheel, fadeWheel, body, ghost, wheelMat, ghostWheelMat];
    return { bodies, wheel, fadeWheel, wheelOpacity, body, ghost, wheelMat, ghostWheelMat, dispose: () => all.forEach((x) => x.dispose()) };
  }, [d, time]);
  useCarReflections([built.body, built.ghost, built.wheelMat, built.ghostWheelMat]);
  const motion = useMemo(() => new TrafficMotion(), []);
  const split = useMemo(() => new FadeSplit(MAX_TRAFFIC), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), c: new THREE.Color(), counts: new Int32Array(CAR_KINDS), fades: new Int32Array(CAR_KINDS) }), []);

  useFrame((_, dt) => {
    const world = frame.world;
    const w = wheels.current;
    const fw = fadingWheels.current;
    time.value += Math.min(dt, 0.1);
    if (!world || !w || !fw) return;
    motion.update(world, Math.min(dt, 0.1));
    tmp.counts.fill(0);
    tmp.fades.fill(0);
    split.begin(Math.min(dt, 1));
    let wheelCount = 0;
    let fadeWheelCount = 0;
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
      else {
        for (let k4 = 0; k4 < 4; k4++) built.wheelOpacity.setX(fadeWheelCount + k4, opacity);
        fadeWheelCount = placeWheels(motion, i, world, tmp.m, fw, fadeWheelCount);
      }
    }
    for (let k = 0; k < CAR_KINDS; k++) {
      finish(solid.current[k], tmp.counts[k]);
      finish(fading.current[k], tmp.fades[k]);
      built.bodies[k].opacity.needsUpdate = true;
    }
    w.count = wheelCount;
    w.instanceMatrix.needsUpdate = true;
    fw.count = fadeWheelCount;
    fw.instanceMatrix.needsUpdate = true;
    built.wheelOpacity.needsUpdate = true;
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
      <instancedMesh ref={fadingWheels} args={[built.fadeWheel, built.ghostWheelMat, MAX_TRAFFIC * 4]} frustumCulled={false} renderOrder={2} />
    </group>
  );
}
