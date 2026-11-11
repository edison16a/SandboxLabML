'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { NAV_RUNNING } from '@/engine/navigation/agent';
import { SNAP_FLAGS, SNAP_SPEED, SNAP_STATUS, SNAP_STOP_TIME } from '@/engine/navigation/snapshot';
import { instancedCharacterGeometry } from '@/render/hideseek/characters/instancedCharacter';
import { cadence } from '@/render/hideseek/characters/motion/gait';
import { commit } from '@/render/hideseek/grid/scratch';
import { useDisposable } from '@/render/shared/useDisposable';
import { POSE_PRIORITY, useNavScene } from '../frame/sceneContext';
import { blendAgent, STRIDE } from '../frame/snapshotRead';
import { NAV_COLORS } from '../palette';
import { hidesChampion } from './clearance';
import { crushAlongForward } from './crushAxis';
import { crowdFadeMaterial, crowdFadeShadowMaterial, crowdSolidMaterial, instanceFloats } from './crowdMaterials';
import { createStopPose, stopPose } from './stopPose';

/** Most agents the crowd draws. */
export const MAX_AGENTS = 320;
const BODY = new THREE.Color(NAV_COLORS.runner).lerp(new THREE.Color(NAV_COLORS.crowdGrey), 0.3);
const GREY = new THREE.Color(NAV_COLORS.dormant);
const FLASH = new THREE.Color(NAV_COLORS.senseSpikes);
/** A crush flashes amber, like the mover that did it and its ring. */
const CRUSH_FLASH = new THREE.Color(NAV_COLORS.senseMover);
/** Crowd members closer than this to the champion, or in front of it toward the camera (see hidesChampion), fade back, m, so the one the view follows never hides in the pack. */
const CLEAR_RADIUS = 0.85;
const CLEAR_RADIUS_ENDED = 1.6;
/** How far they fade, and how fast they fade out and back in, 1/s. */
const CLEAR_ALPHA = 0.22;
const CLEAR_OUT = 12;
const CLEAR_IN = 5;

/** One instanced mesh of crowd characters with its own walk attribute (and fade, for the fading pass). */
function crowdMesh(fading: boolean) {
  const geometry = instancedCharacterGeometry();
  const gait = instanceFloats(MAX_AGENTS, 2);
  geometry.setAttribute('aGait', gait);
  const fade = instanceFloats(MAX_AGENTS);
  if (fading) geometry.setAttribute('aFade', fade);
  return { geometry, gait, fade, dispose: () => geometry.dispose() };
}

/**
 * The whole population but the champion, as the same characters at lower
 * detail, a little greyer, in one instanced draw call: legs and arms swing
 * at the cadence of each one's real speed and they lean into a run. A run
 * that ends plays out on the spot (see stopPose): a fall onto the spikes,
 * a squash under a mover, a hop past the line, then a fade. Fading ones
 * move to a second small mesh with per instance opacity, whose shadows
 * thin out with them.
 */
export function CrowdAgents() {
  const { frame } = useNavScene();
  const solid = useRef<THREE.InstancedMesh>(null);
  const fading = useRef<THREE.InstancedMesh>(null);
  const a = useDisposable(() => crowdMesh(false), []);
  const b = useDisposable(() => crowdMesh(true), []);
  const solidMat = useDisposable(() => crowdSolidMaterial(), []);
  const fadeMat = useDisposable(() => crowdFadeMaterial(), []);
  const fadeShadow = useDisposable(() => crowdFadeShadowMaterial(), []);
  const t = useMemo(
    () => ({
      pose: { x: 0, z: 0, yaw: 0 },
      stop: createStopPose(),
      phase: new Float32Array(MAX_AGENTS),
      clear: new Float32Array(MAX_AGENTS).fill(1),
      m: new THREE.Matrix4(),
      p: new THREE.Vector3(),
      q: new THREE.Quaternion(),
      s: new THREE.Vector3(),
      e: new THREE.Euler(0, 0, 0, 'YXZ'),
      c: new THREE.Color(),
    }),
    [],
  );

  useFrame(({ clock, camera }, dt) => {
    const ms = solid.current;
    const mf = fading.current;
    if (!ms || !mf) return;
    const curr = frame.curr;
    if (!curr) {
      commit(ms, 0);
      commit(mf, 0);
      return;
    }
    const step = frame.simDt;
    const time = clock.elapsedTime;
    let ns = 0;
    let nf = 0;
    const count = Math.min(frame.count, MAX_AGENTS);
    // Once the champion's run is over the pack clears a wider space, so its fall or its hop is seen whole.
    const clearRadius = frame.leader >= 0 && curr[frame.leader * STRIDE + SNAP_STATUS] !== NAV_RUNNING ? CLEAR_RADIUS_ENDED : CLEAR_RADIUS;
    const lp = frame.leaderPose;
    // The camera's direction over the floor from the champion, for the strip kept clear in front of it.
    let dx = camera.position.x - lp.x;
    let dz = camera.position.z - lp.z;
    const dl = Math.hypot(dx, dz);
    dx = dl > 1e-3 ? dx / dl : 0;
    dz = dl > 1e-3 ? dz / dl : 1;
    for (let i = 0; i < count; i++) {
      if (i === frame.leader) continue;
      const o = i * STRIDE;
      stopPose(curr[o + SNAP_STATUS], curr[o + SNAP_FLAGS], frame.time - curr[o + SNAP_STOP_TIME], t.stop);
      const st = t.stop;
      blendAgent(frame.prev, curr, i, frame.alpha, t.pose);
      // Eased per agent on wall time, so one walking past the champion melts away and back instead of popping.
      const near = frame.leader >= 0 && hidesChampion(t.pose.x, t.pose.z, lp.x, lp.z, dx, dz, clearRadius);
      const goal = near ? CLEAR_ALPHA : 1;
      t.clear[i] += (goal - t.clear[i]) * Math.min(1, (goal < t.clear[i] ? CLEAR_OUT : CLEAR_IN) * Math.min(dt, 0.1));
      const alpha = st.alpha * t.clear[i];
      if (alpha <= 0.01) continue;
      const speed = Math.abs(curr[o + SNAP_SPEED]);
      const run = Math.min(1, speed / 3);
      const stride = (t.phase[i] = (t.phase[i] + step * cadence(speed) * Math.PI * 2) % (Math.PI * 2));
      const bob = (1 - run) * (0.006 + Math.sin(time * 2.1 + i * 1.7) * 0.006) + run * Math.abs(Math.sin(stride)) * 0.035;
      t.e.set(0, t.pose.yaw + st.spin, -(run * 0.14 + st.tip));
      t.q.setFromEuler(t.e);
      t.p.set(t.pose.x, bob + st.lift, t.pose.z);
      // A crushed one flattens along the push: its own forward axis or the one across it, whichever is nearer.
      const thinForward = st.thin < 1 && frame.course !== null && crushAlongForward(frame.course, frame.movers, t.pose.x, t.pose.z, t.pose.yaw + st.spin);
      t.s.set(st.spread * (thinForward ? st.thin : 1), st.squash, st.spread * (thinForward ? 1 : st.thin));
      t.m.compose(t.p, t.q, t.s);
      t.c.copy(BODY).lerp(GREY, st.grey).lerp(st.thin < 1 ? CRUSH_FLASH : FLASH, st.flash * 0.55);
      const amp = st.tip !== 0 || st.squash < 1 || st.airborne ? 0 : Math.min(0.6, speed * 0.22);
      if (alpha >= 0.99) {
        ms.setMatrixAt(ns, t.m);
        ms.setColorAt(ns, t.c);
        a.gait.setXY(ns++, stride, amp);
      } else {
        mf.setMatrixAt(nf, t.m);
        mf.setColorAt(nf, t.c);
        b.gait.setXY(nf, stride, amp);
        b.fade.setX(nf++, alpha);
      }
    }
    commit(ms, ns);
    commit(mf, nf);
    a.gait.needsUpdate = b.gait.needsUpdate = b.fade.needsUpdate = true;
  }, POSE_PRIORITY);

  return (
    <group>
      <instancedMesh ref={solid} args={[a.geometry, solidMat, MAX_AGENTS]} frustumCulled={false} castShadow receiveShadow />
      {/* After the champion's own passes, so a ghost in front of it only tints it. */}
      {/* It casts its thinning shadow but takes none: a hashed shadow falling on its own see-through body speckles it. */}
      <instancedMesh ref={fading} args={[b.geometry, fadeMat, MAX_AGENTS]} frustumCulled={false} renderOrder={5} castShadow customDepthMaterial={fadeShadow} />
    </group>
  );
}
