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
import type { FrameSource } from '../frame/source';
import { ARRIVED_COLOR, CRASHED_COLOR, ghostColor, glassTint, speciesColor } from './palette';
import { blocksSight, PoseSet } from './sightFade';

const MAX = 256;
const STRIDE = DRIVING_SNAPSHOT.stride;
/** Ghost opacity while driving, and once stopped. */
const GHOST = 0.3;
const STOPPED = 0.16;
/** A ghost this close to the followed SUV, or to the lens, fades away, m. */
const NEAR_FOCUS = 5.2;
const NEAR_LENS = 6;

interface Props {
  /** The SUVs to draw. Left out, the scene's population, with the followed one left to FollowedSuv. */
  source?: FrameSource | null;
  /** Species hues for a generation; an age ramp for past champions, whose tags are their generations. */
  colors?: 'species' | 'age';
  /** Told the population index of an SUV the user clicks. */
  onPick?: (index: number) => void;
}

/**
 * The rest of the generation, every SUV but the followed one, as soft
 * translucent ghosts in one instanced draw call, colored by species. They
 * drive the same route through the same city and never touch each other,
 * so solid bodies would cut into one another; as ghosts the whole
 * population stays readable. A depth pass first keeps only the nearest
 * ghost surface per pixel, so a stack of them reads as one shape. Ghosts
 * ease out where they would sit on the followed SUV, on the lens or in
 * the camera's line of sight to the followed SUV, and a ghost on the same
 * spot as one already drawn (past champions replaying the same start)
 * gives way to it. Their colors are muted toward clear glass, so the
 * followed SUV keeps the only real paint; a crashed one turns graphite,
 * an arrived one green. The lab draws past champions with it too, from
 * their own stream, on an age ramp.
 */
export function PopulationSuvs({ source, colors, onPick }: Props = {}) {
  const scene = useDrivingScene();
  const { frame, view, tier } = scene;
  const own = source === undefined;
  const population = own ? scene.population : source;
  const tint = colors ?? view.colors ?? 'species';
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
  const placed = useMemo(() => new PoseSet(MAX), []);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), s: new THREE.Vector3(1, 1, 1), c: new THREE.Color(), up: new THREE.Vector3(0, 1, 0), pose: { x: 0, y: 0, heading: 0 } as Pose, epoch: -1 }), []);
  /** Draw slot to population index, so a click on an instance finds its SUV. */
  const slots = useMemo(() => new Int32Array(MAX), []);

  useFrame((state, dt) => {
    const g = mesh.current;
    const d = depth.current;
    if (!g || !d) return;
    if (d.instanceMatrix !== g.instanceMatrix) d.instanceMatrix = g.instanceMatrix;
    const curr = population?.curr;
    if (!population || !curr || (own && !view.population)) {
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
    const sees = frame.focus >= 0;
    placed.clear();
    let slot = 0;
    for (let i = 0; i < n; i++) {
      const o = i * STRIDE;
      blendPose(prev, curr.buffer, o, a, tmp.pose);
      const x = tmp.pose.x;
      const z = -tmp.pose.y;
      const status = curr.buffer[o + SNAP.status];
      // The followed SUV is the scene population's; past champions only fade where they would sit on it.
      const onFocus = (own && i === frame.focus) || (frame.focus >= 0 && Math.hypot(x - frame.pos.x, z - frame.pos.z) < NEAR_FOCUS);
      const atLens = Math.hypot(x - cam.x, z - cam.z) < NEAR_LENS && cam.y < 4;
      const inSight = sees && blocksSight(cam.x, cam.y, cam.z, frame.pos.x, frame.pos.z, x, z);
      const hidden = onFocus || atLens || inSight || placed.has(x, z, tmp.pose.heading);
      const target = hidden ? 0 : status === STATUS_DRIVING || status === STATUS_ARRIVED ? 1 : STOPPED / GHOST;
      if (!hidden) placed.add(x, z, tmp.pose.heading);
      const shown = split.place(i, target, restart || (own && i === frame.focus));
      if (shown < 0.02) continue;
      tmp.m.compose(tmp.p.set(x, 0.01, z), tmp.q.setFromAxisAngle(tmp.up, tmp.pose.heading), tmp.s);
      g.setMatrixAt(slot, tmp.m);
      slots[slot] = i;
      if (status === STATUS_CRASHED) tmp.c.copy(CRASHED_COLOR);
      else if (status === STATUS_ARRIVED) glassTint(tmp.c.copy(ARRIVED_COLOR));
      else if (tint === 'age') glassTint(ghostColor(n > 1 ? i / (n - 1) : 1, tmp.c));
      else glassTint(speciesColor(population.tags[i] ?? 0, tmp.c));
      g.setColorAt(slot, tmp.c);
      built.opacity.setX(slot, GHOST * shown);
      slot++;
    }
    g.count = d.count = slot;
    // The SUVs moved, so a click must work the bounds out afresh (three keeps them once computed).
    g.boundingSphere = null;
    g.instanceMatrix.needsUpdate = true;
    if (g.instanceColor) g.instanceColor.needsUpdate = true;
    built.opacity.needsUpdate = true;
  });

  return (
    <group>
      <instancedMesh ref={depth} args={[built.geometry, built.prepass, MAX]} frustumCulled={false} renderOrder={1} raycast={() => null} />
      <instancedMesh
        ref={mesh}
        args={[built.geometry, built.material, MAX]}
        frustumCulled={false}
        renderOrder={2}
        onClick={
          onPick &&
          ((e) => {
            if (e.instanceId === undefined) return;
            e.stopPropagation();
            onPick(slots[e.instanceId]);
          })
        }
      />
    </group>
  );
}
