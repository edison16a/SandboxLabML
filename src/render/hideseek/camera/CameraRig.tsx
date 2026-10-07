'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';
import { stepSpring } from '@/render/shared/interpolate';
import { useHsScene } from '../frame/sceneContext';
import { followedAgent } from '../frame/followedAgent';
import { boxDrag } from '../interaction/useBoxDrag';
import { arenaOrigin, ARENA_SPAN } from '../layout/gridLattice';
import { firstPersonAgent, FOLLOW, followedAgentOf, presetShot, shotKey } from './cameraViews';
import { fitDepthRange } from './depthRange';
import { CLOSE_AZIMUTH, easeInOutCubic, orbitShot, type Shot } from './framing';

/** How long a change of view or focus takes to fly, s. */
const FLY_SECONDS = 0.6;
/** Eye height of the first person cameras, m: just under the top of a 1.5 m agent. */
const EYE = 1.32;
/** The camera never dips below this, m, so no view ever looks up through the floor. */
const MIN_HEIGHT = 0.3;
/** Key of the free view: it has no shot of its own, it only follows the focused arena when that changes. */
const FREE = -1;

type Controls = React.ComponentRef<typeof OrbitControls>;

/**
 * Every camera view of the lab. Set shots fly into place over 600 ms
 * whenever the view, the focus or the grid changes; follow views keep an
 * agent in frame on a soft spring while you orbit round it; the free view
 * never moves by itself and carries over to a newly focused arena; first
 * person views ride on an agent. Orbit, pan and zoom work in every view but
 * first person.
 */
export function CameraRig() {
  const { frame } = useHsScene();
  const mode = useHideSeekLab((s) => s.camera);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const scene = useThree((s) => s.scene);
  const controls = useRef<Controls>(null);
  const r = useMemo(
    () => ({
      key: Number.NaN,
      started: false,
      t: 1,
      fromPos: new THREE.Vector3(),
      fromTarget: new THREE.Vector3(),
      toPos: new THREE.Vector3(),
      toTarget: new THREE.Vector3(),
      look: new THREE.Vector3(),
      delta: new THREE.Vector3(),
      o: { x: 0, z: 0 },
      origin: { x: 0, z: 0 },
      pose: { x: 0, z: 0, yaw: 0, elevation: 0 },
      aim: { x: { value: 0, velocity: 0 }, y: { value: 0, velocity: 0 }, z: { value: 0, velocity: 0 } },
    }),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const c = controls.current;
    const m = useHideSeekLab.getState().camera;
    const eyes = firstPersonAgent(m);
    if (c) c.enabled = eyes < 0 && r.t >= 1 && !boxDrag.active;
    const target = c?.target ?? r.toTarget;
    fitDepthRange(camera, scene, frame, eyes >= 0 ? 0 : camera.position.distanceTo(target), target);
    if (eyes >= 0) return firstPerson(eyes);
    if (!c) return;
    const team = followedAgentOf(m);
    if (team >= 0 && agentInWorld(team)) follow(c, m, dt);
    else if (m === 'free') free(c);
    else preset(c, m);
    if (r.t < 1) stepFly(c, dt);
    if (camera.position.y < MIN_HEIGHT) camera.position.y = MIN_HEIGHT;
  });

  /** Origin of the focused arena, or the grid center when none is focused. */
  function focusOrigin(): { x: number; z: number } {
    if (frame.focusSlot >= 0) return arenaOrigin(frame.focusSlot, frame.lattice, r.o);
    r.o.x = r.o.z = 0;
    return r.o;
  }

  /** Reads agent `agent` of the focused arena (or the first) into r.pose, in world space. False when there is nobody. */
  function agentInWorld(agent: number): boolean {
    const slot = Math.max(0, frame.focusSlot);
    if (followedAgent(frame, slot, agent, r.pose) < 0) return false;
    arenaOrigin(slot, frame.lattice, r.o);
    r.pose.x += r.o.x;
    r.pose.z += r.o.z;
    return true;
  }

  function startFly(c: Controls, shot: Shot): void {
    r.fromPos.copy(camera.position);
    r.fromTarget.copy(c.target);
    r.toPos.set(shot.px, shot.py, shot.pz);
    r.toTarget.set(shot.tx, shot.ty, shot.tz);
    // The very first framing jumps; later ones fly.
    r.t = r.started ? 0 : 1;
    r.started = true;
    if (r.t >= 1) {
      camera.position.copy(r.toPos);
      c.target.copy(r.toTarget);
      camera.lookAt(r.toTarget);
      c.update();
    }
  }

  function stepFly(c: Controls, dt: number): void {
    r.t = Math.min(1, r.t + dt / FLY_SECONDS);
    const e = easeInOutCubic(r.t);
    camera.position.lerpVectors(r.fromPos, r.toPos, e);
    r.look.lerpVectors(r.fromTarget, r.toTarget, e);
    c.target.copy(r.look);
    camera.lookAt(r.look);
    c.update();
    invalidate();
  }

  function preset(c: Controls, m: typeof mode): void {
    // A follow view with nobody to follow shows the close shot under a key of its own, so it flies to the agent once one turns up.
    const key = shotKey(m, frame.focusSlot, frame.count, frame.lattice.cols) + (followedAgentOf(m) >= 0 ? 0.5 : 0);
    if (key === r.key) return;
    r.key = key;
    const focus = frame.focusSlot >= 0 ? focusOrigin() : null;
    startFly(c, presetShot(m, focus, frame.lattice, ARENA_SPAN, camera.fov, size.width / Math.max(1, size.height)));
  }

  /**
   * Flies to the follow shot, aiming at the agent as it moves, then lets
   * the aim trail the agent on a critically damped spring. Camera and aim
   * move together, so whatever angle and distance you orbit to are kept.
   */
  function follow(c: Controls, m: typeof mode, dt: number): void {
    const ax = r.pose.x;
    const ay = FOLLOW.height + r.pose.elevation * 0.8;
    const az = r.pose.z;
    const key = shotKey(m, frame.focusSlot, frame.count, frame.lattice.cols);
    if (key !== r.key) {
      r.key = key;
      startFly(c, orbitShot(ax, az, FOLLOW.distance, FOLLOW.elevation, CLOSE_AZIMUTH, ay));
    }
    if (r.t < 1) {
      // Mid flight the destination moves with the agent.
      r.toTarget.set(ax, ay, az);
      r.toPos.set(ax + Math.sin(CLOSE_AZIMUTH) * Math.cos(FOLLOW.elevation) * FOLLOW.distance, ay + Math.sin(FOLLOW.elevation) * FOLLOW.distance, az + Math.cos(CLOSE_AZIMUTH) * Math.cos(FOLLOW.elevation) * FOLLOW.distance);
      r.aim.x.value = ax;
      r.aim.y.value = ay;
      r.aim.z.value = az;
      r.aim.x.velocity = r.aim.y.velocity = r.aim.z.velocity = 0;
      return;
    }
    r.delta.set(stepSpring(r.aim.x, ax, FOLLOW.stiffness, dt), stepSpring(r.aim.y, ay, FOLLOW.stiffness, dt), stepSpring(r.aim.z, az, FOLLOW.stiffness, dt)).sub(c.target);
    c.target.add(r.delta);
    camera.position.add(r.delta);
    invalidate();
  }

  /** The free view keeps wherever you put it; a new focus carries it over by the same offset. */
  function free(c: Controls): void {
    const o = focusOrigin();
    if (r.key !== FREE) {
      r.key = FREE;
      r.t = 1;
    } else if (o.x !== r.origin.x || o.z !== r.origin.z) {
      r.delta.set(o.x - r.origin.x, 0, o.z - r.origin.z);
      camera.position.add(r.delta);
      c.target.add(r.delta);
    }
    r.origin.x = o.x;
    r.origin.z = o.z;
  }

  function firstPerson(agent: number): void {
    // Leaving first person flies back from wherever the eye was.
    r.key = Number.NaN;
    if (!agentInWorld(agent)) return;
    const fx = Math.cos(r.pose.yaw);
    const fz = -Math.sin(r.pose.yaw);
    // Eyes ride up a ramp and through a jump with the agent.
    const lift = r.pose.elevation;
    camera.position.set(r.pose.x + fx * 0.5, EYE + lift, r.pose.z + fz * 0.5);
    r.look.set(camera.position.x + fx * 6, 0.9 + lift, camera.position.z + fz * 6);
    camera.lookAt(r.look);
  }

  const free_ = mode === 'free';
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.09}
      screenSpacePanning={false}
      zoomToCursor={free_}
      maxPolarAngle={free_ ? 1.48 : 1.5}
      minDistance={free_ ? 1.2 : 2.5}
      maxDistance={700}
    />
  );
}
