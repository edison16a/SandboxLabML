'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { STATUS_ARRIVED, STATUS_CRASHED, STATUS_DRIVING } from '@/engine/driving/agent/learner';
import { DRIVING_SNAPSHOT, SNAP } from '@/engine/driving/snapshot';
import { attachOpacity, createFadeMaterial } from '@/render/shared/fadeMaterial';
import { blendPose, type Pose } from '@/render/shared/interpolate';
import { useDisposable } from '@/render/shared/useDisposable';
import { useDrivingScene } from '../frame/sceneContext';
import { crowdSuvGeometry } from '../suv/geometry/assemble';
import { DETAIL } from '../suv/geometry/parts';
import { withCarSurface } from '../suv/materials/carSurface';
import { useCarReflections } from '../suv/materials/useCarReflections';
import { FadeSplit } from './fadeSplit';
import { ARRIVED_COLOR, CRASHED_COLOR, speciesColor } from './palette';

const MAX = 256;
const STRIDE = DRIVING_SNAPSHOT.stride;
/** Ghost opacity while driving, and once stopped. */
const GHOST = 0.36;
const STOPPED = 0.18;
/** A ghost this close to the followed SUV, or to the lens, fades away, m. */
const NEAR_FOCUS = 5.2;
const NEAR_LENS = 6;

/**
 * The rest of the generation, every SUV but the followed one, as soft
 * translucent ghosts in one instanced draw call, colored by species. They
 * drive the same route through the same city and never touch each other,
 * so solid bodies would cut into one another; as ghosts the whole
 * population stays readable. A depth pass first keeps only the nearest
 * ghost surface per pixel, so a stack of them reads as one shape. Ghosts
 * ease out where they would sit on the followed SUV or on the lens, and
 * a crashed one turns graphite, an arrived one green.
 */
export function PopulationSuvs() {
  const { population, frame, view, tier } = useDrivingScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const depth = useRef<THREE.InstancedMesh>(null);
  const built = useDisposable(() => {
    const geometry = crowdSuvGeometry(tier === 'low' ? DETAIL.crowdLow : DETAIL.crowd);
    const opacity = attachOpacity(geometry, MAX);
    const material = withCarSurface(createFadeMaterial({ vertexColors: true, depthFunc: THREE.LessEqualDepth }), { ghost: true });
    const prepass = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, depthWrite: true });
    return { geometry, opacity, material, prepass, dispose: () => [geometry, material, prepass].forEach((x) => x.dispose()) };
  }, [tier]);
  useCarReflections([built.material]);
  const split = useMemo(() => new FadeSplit(MAX), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), c: new THREE.Color(), up: new THREE.Vector3(0, 1, 0), pose: { x: 0, y: 0, heading: 0 } as Pose, epoch: -1 }), []);

  useFrame((state, dt) => {
    const g = mesh.current;
    const d = depth.current;
    if (!g || !d) return;
    if (d.instanceMatrix !== g.instanceMatrix) d.instanceMatrix = g.instanceMatrix;
    const curr = population?.curr;
    if (!population || !curr || !view.population) {
      g.count = d.count = 0;
      return;
    }
    const restart = population.epoch !== tmp.epoch;
    tmp.epoch = population.epoch;
    split.begin(Math.min(dt, 1));
    const prev = population.prev?.buffer ?? null;
    const a = population.alpha();
    const n = Math.min(population.count, MAX);
    const cam = state.camera.position;
    let slot = 0;
    for (let i = 0; i < n; i++) {
      const o = i * STRIDE;
      blendPose(prev, curr.buffer, o, a, tmp.pose);
      const x = tmp.pose.x;
      const z = -tmp.pose.y;
      const status = curr.buffer[o + SNAP.status];
      const onFocus = i === frame.focus || (frame.focus >= 0 && Math.hypot(x - frame.pos.x, z - frame.pos.z) < NEAR_FOCUS);
      const atLens = Math.hypot(x - cam.x, z - cam.z) < NEAR_LENS && cam.y < 4;
      const target = onFocus || atLens ? 0 : status === STATUS_DRIVING || status === STATUS_ARRIVED ? 1 : STOPPED / GHOST;
      const shown = split.place(i, target, restart || i === frame.focus);
      if (shown < 0.02) continue;
      tmp.m.compose(tmp.p.set(x, 0.01, z), tmp.q.setFromAxisAngle(tmp.up, tmp.pose.heading), tmp.s);
      g.setMatrixAt(slot, tmp.m);
      if (status === STATUS_CRASHED) tmp.c.copy(CRASHED_COLOR);
      else if (status === STATUS_ARRIVED) tmp.c.copy(ARRIVED_COLOR);
      else speciesColor(population.tags[i] ?? 0, tmp.c);
      g.setColorAt(slot, tmp.c);
      built.opacity.setX(slot, GHOST * shown);
      slot++;
    }
    g.count = d.count = slot;
    g.instanceMatrix.needsUpdate = true;
    if (g.instanceColor) g.instanceColor.needsUpdate = true;
    built.opacity.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={depth} args={[built.geometry, built.prepass, MAX]} frustumCulled={false} renderOrder={1} raycast={() => null} />
      <instancedMesh ref={mesh} args={[built.geometry, built.material, MAX]} frustumCulled={false} renderOrder={2} />
    </group>
  );
}
