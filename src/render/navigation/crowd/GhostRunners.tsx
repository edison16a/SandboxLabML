'use client';

import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { SNAP_FLAGS, SNAP_SPEED, SNAP_STATUS, SNAP_STOP_TIME } from '@/engine/navigation/snapshot';
import { instancedCharacterGeometry } from '@/render/navigation/character/instancedCharacter';
import { cadence } from '@/render/navigation/character/motion/gait';
import { commit } from '@/render/navigation/frame/instancing';
import { useDisposable } from '@/render/shared/useDisposable';
import { POSE_PRIORITY, useNavScene } from '../frame/sceneContext';
import { blendAgent, STRIDE } from '../frame/snapshotRead';
import { NAV_COLORS } from '../palette';
import { hidesChampion } from './clearance';
import { crowdFadeMaterial, instanceFloats } from './crowdMaterials';
import { createStopPose, stopPose } from './stopPose';

/** Most ghosts drawn: the replay's cap of 32 champions, with room for Sandbox copies. */
const MAX_GHOSTS = 64;
/** Drawn with the other see-through bodies, after everything solid and the sensor marks. */
const GHOST_ORDER = 8;
const OLD = new THREE.Color(NAV_COLORS.ghostOld);
const NEW = new THREE.Color(NAV_COLORS.ghostNew);
/** Opacity of the oldest and the newest champion. Newer ghosts read stronger, as they matter more. */
const ALPHA_OLD = 0.22;
const ALPHA_NEW = 0.5;
/** Ghosts in front of the followed runner fade further back, as the crowd does. */
const CLEAR_RADIUS = 0.85;
const CLEAR_ALPHA = 0.3;

/**
 * Past champions replayed as see-through runners in one instanced draw
 * call: the older the generation, the cooler and fainter. They walk,
 * fall and celebrate like the crowd, on the replay's own clock, and the
 * one the view follows is left to the champion character.
 */
export function GhostRunners() {
  const { frame, onPick } = useNavScene();
  const mesh = useRef<THREE.InstancedMesh>(null);
  const built = useDisposable(() => {
    const geometry = instancedCharacterGeometry();
    const gait = instanceFloats(MAX_GHOSTS, 2);
    const fade = instanceFloats(MAX_GHOSTS);
    geometry.setAttribute('aGait', gait);
    geometry.setAttribute('aFade', fade);
    const material = crowdFadeMaterial();
    return { geometry, gait, fade, material, dispose: () => (geometry.dispose(), material.dispose()) };
  }, []);
  const t = useMemo(
    () => ({
      pose: { x: 0, z: 0, yaw: 0 },
      stop: createStopPose(),
      phase: new Float32Array(MAX_GHOSTS),
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      e: new THREE.Euler(0, 0, 0, 'YXZ'),
      c: new THREE.Color(),
      /** The ghost each instance draws, for clicks. */
      ids: new Int16Array(MAX_GHOSTS),
    }),
    [],
  );
  // Only ghosts the view can follow take clicks: with the population on screen, it stays the followed feed.
  const pick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId === undefined || !onPick || !frame.primaryGhosts) return;
    e.stopPropagation();
    onPick(true, t.ids[e.instanceId]);
  };

  useFrame(({ camera }) => {
    const m = mesh.current;
    if (!m) return;
    const g = frame.ghosts;
    const curr = g.curr;
    if (!curr || g.count === 0) return commit(m, 0);
    const step = frame.primaryGhosts ? frame.simDt : Math.min(0.25, frame.simDt);
    const lp = frame.leaderPose;
    let dx = camera.position.x - lp.x;
    let dz = camera.position.z - lp.z;
    const dl = Math.hypot(dx, dz);
    dx = dl > 1e-3 ? dx / dl : 0;
    dz = dl > 1e-3 ? dz / dl : 1;
    const count = Math.min(g.count, MAX_GHOSTS);
    let n = 0;
    for (let i = 0; i < count; i++) {
      if (i === g.skip) continue;
      const o = i * STRIDE;
      stopPose(curr[o + SNAP_STATUS], curr[o + SNAP_FLAGS], g.time - curr[o + SNAP_STOP_TIME], t.stop);
      const st = t.stop;
      blendAgent(g.prev, curr, i, g.alpha, t.pose);
      const rank = count > 1 ? i / (count - 1) : 1;
      const near = frame.leader >= 0 && hidesChampion(t.pose.x, t.pose.z, lp.x, lp.z, dx, dz, CLEAR_RADIUS);
      const alpha = st.alpha * (ALPHA_OLD + (ALPHA_NEW - ALPHA_OLD) * rank) * (near ? CLEAR_ALPHA : 1);
      if (alpha <= 0.01) continue;
      const speed = Math.abs(curr[o + SNAP_SPEED]);
      const run = Math.min(1, speed / 3);
      const stride = (t.phase[i] = (t.phase[i] + step * cadence(speed) * Math.PI * 2) % (Math.PI * 2));
      t.e.set(0, t.pose.yaw + st.spin, -(run * 0.14 + st.tip));
      t.q.setFromEuler(t.e);
      t.p.set(t.pose.x, run * Math.abs(Math.sin(stride)) * 0.035 + st.lift, t.pose.z);
      t.s.set(st.spread * st.thin, st.squash, st.spread);
      t.m.compose(t.p, t.q, t.s);
      t.ids[n] = i;
      m.setMatrixAt(n, t.m);
      m.setColorAt(n, t.c.copy(OLD).lerp(NEW, rank));
      built.gait.setXY(n, stride, st.tip !== 0 || st.squash < 1 || st.airborne ? 0 : Math.min(0.6, speed * 0.22));
      built.fade.setX(n++, alpha);
    }
    commit(m, n);
    built.gait.needsUpdate = built.fade.needsUpdate = true;
  }, POSE_PRIORITY);

  return <instancedMesh ref={mesh} args={[built.geometry, built.material, MAX_GHOSTS]} frustumCulled={false} renderOrder={GHOST_ORDER} onClick={pick} />;
}
