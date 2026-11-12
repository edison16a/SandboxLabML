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
/**
 * Ghosts in front of the followed runner, toward the camera, fade nearly
 * out: see-through bodies stacked over it read as a smear, where the
 * solid crowd only needs to step back a little.
 */
const CLEAR_RADIUS = 0.85;
const CLEAR_ALPHA = 0.1;
/**
 * Copies of one brain run the same line, and drawn on top of each other
 * they read as one body with several heads. A ghost this close to the
 * followed runner, or to a ghost drawn before it, fades out, fully by the
 * near distance, so they merge into one and part again smoothly, m.
 */
const MERGE_NEAR = 0.45;
const MERGE_FAR = 1.1;

/** 0 at `a` or closer, 1 at `b` or further, smooth between. */
function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/**
 * Past champions replayed as see-through runners in one instanced draw
 * call: the older the generation, the cooler and fainter. They walk,
 * fall and celebrate like the crowd, on the replay's own clock, and the
 * one the view follows is left to the champion character. Ghosts that
 * run on top of it or of each other (copies of one brain do) fade into
 * one.
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
      /** Where each drawn ghost stands this frame, for the merge fade. */
      xs: new Float32Array(MAX_GHOSTS),
      zs: new Float32Array(MAX_GHOSTS),
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
      let gap = frame.leader >= 0 ? Math.hypot(t.pose.x - lp.x, t.pose.z - lp.z) : Infinity;
      for (let j = 0; j < n && gap > MERGE_NEAR; j++) gap = Math.min(gap, Math.hypot(t.pose.x - t.xs[j], t.pose.z - t.zs[j]));
      const alpha = st.alpha * (ALPHA_OLD + (ALPHA_NEW - ALPHA_OLD) * rank) * (near ? CLEAR_ALPHA : 1) * smoothstep(MERGE_NEAR, MERGE_FAR, gap);
      if (alpha <= 0.01) continue;
      t.xs[n] = t.pose.x;
      t.zs[n] = t.pose.z;
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
