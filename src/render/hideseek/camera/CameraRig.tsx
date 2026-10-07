'use client';

import type * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';
import type { HsCamera } from '@/features/hideseek/state/types';
import { useHsScene } from '../frame/sceneContext';
import { followedAgent } from '../frame/followedAgent';
import { boxDrag } from '../interaction/useBoxDrag';
import { arenaOrigin, ARENA_SPAN } from '../layout/gridLattice';
import { firstPersonAgent, followedAgentOf, presetShot, shotKey } from './cameraViews';
import { fitDepthRange } from './depthRange';
import { Flight } from './flight';
import { FollowCam } from './followCam';

/** Eye height of the first person cameras, m: just under the top of a 1.5 m agent. */
const EYE = 1.32;
/** The camera never dips below this, m, so no view ever looks up through the floor. */
const MIN_HEIGHT = 0.3;
/** How far past the arenas the orbit point may be panned, m. */
const PAN_MARGIN = 12;
/** Key of the free view: it has no shot of its own, it only follows the scene when that changes. */
const FREE = -1;

type Controls = React.ComponentRef<typeof OrbitControls>;

/**
 * Every camera view of the lab. Set shots fly into place whenever the
 * view, the focus or the grid changes; follow views keep an agent in frame
 * and swing round walls that hide it (see FollowCam); the free view never
 * moves by itself and carries over to a newly focused arena; first person views
 * ride on an agent. Orbit, pan and zoom work in every view but first
 * person, and never take the camera under the floor or far off the arenas.
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
      flight: new Flight(),
      follow: new FollowCam(),
      o: { x: 0, z: 0 },
      /** The scene the free view was last carried to: its center. */
      scene: { x: 0, z: 0 },
      pose: { x: 0, z: 0, yaw: 0, elevation: 0 },
      target: { key: 0, x: 0, z: 0, elevation: 0, ox: 0, oz: 0, epoch: 0, walls: frame.walls },
    }),
    [frame],
  );
  const f = r.flight;

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const c = controls.current;
    const m = useHideSeekLab.getState().camera;
    // With no arena focused the grid draws only its coarse crowds, so a view that rides on an agent keeps the grid shot until one is.
    const crowd = frame.focusSlot < 0;
    const eyes = crowd ? -1 : firstPersonAgent(m);
    if (c) c.enabled = eyes < 0 && f.t >= 1 && !boxDrag.active;
    const target = c?.target ?? f.toTarget;
    fitDepthRange(camera, scene, frame, eyes >= 0 ? 0 : camera.position.distanceTo(target), target);
    if (eyes >= 0) return firstPerson(eyes);
    if (!c) return;
    const team = crowd ? -1 : followedAgentOf(m);
    if (team >= 0 && agentInWorld(team)) follow(c, m, dt);
    else if (m === 'free') free(c);
    else preset(c, m);
    if (f.t < 1) {
      // A flight runs on wall time up to a quarter second a frame, so it lands on time on a slow machine but never jumps after a stalled tab.
      f.step(camera, c, Math.min(rawDt, 0.25));
      invalidate();
    } else f.keepInBounds(camera, c, frame.lattice.width / 2 + PAN_MARGIN, frame.lattice.depth / 2 + PAN_MARGIN);
    if (camera.position.y < MIN_HEIGHT) camera.position.y = MIN_HEIGHT;
  });

  /** Origin of the focused arena, or the grid center when none is focused. */
  function focusOrigin(): { x: number; z: number } {
    if (frame.focusSlot >= 0) return arenaOrigin(frame.focusSlot, frame.lattice, r.o);
    r.o.x = r.o.z = 0;
    return r.o;
  }

  /** Reads agent `agent` of the focused arena into r.pose, in world space. False when there is nobody. */
  function agentInWorld(agent: number): boolean {
    const slot = frame.focusSlot;
    if (followedAgent(frame, slot, agent, r.pose) < 0) return false;
    arenaOrigin(slot, frame.lattice, r.o);
    r.pose.x += r.o.x;
    r.pose.z += r.o.z;
    return true;
  }

  function shotFor(m: HsCamera) {
    return presetShot(m, frame.focusSlot >= 0 ? focusOrigin() : null, frame.lattice, ARENA_SPAN, camera.fov, size.width / Math.max(1, size.height));
  }

  function preset(c: Controls, m: HsCamera): void {
    // A follow view with nobody to follow shows the close shot under a key of its own, so it flies to the agent once one turns up.
    const key = shotKey(m, frame.focusSlot, frame.count, frame.lattice.cols) + (followedAgentOf(m) >= 0 ? 0.5 : 0);
    if (key === f.key) return;
    f.key = key;
    f.start(camera, c, shotFor(m));
  }

  /** Hands the followed agent (in r.pose and r.o) to the follow camera. */
  function follow(c: Controls, m: HsCamera, dt: number): void {
    const t = r.target;
    t.key = shotKey(m, frame.focusSlot, frame.count, frame.lattice.cols);
    t.x = r.pose.x;
    t.z = r.pose.z;
    t.elevation = r.pose.elevation;
    t.ox = r.o.x;
    t.oz = r.o.z;
    t.epoch = frame.epoch;
    t.walls = frame.walls;
    r.follow.update(camera, c, f, t, dt, frame.timeScale);
    invalidate();
  }

  /** The free view keeps wherever you put it; a new focus carries it over by the same offset. */
  function free(c: Controls): void {
    const o = focusOrigin();
    const s = r.scene;
    if (f.key !== FREE) {
      f.key = FREE;
      f.t = 1;
    } else if (o.x !== s.x || o.z !== s.z) f.carry(camera, c, o.x - s.x, 0, o.z - s.z);
    s.x = o.x;
    s.z = o.z;
  }

  function firstPerson(agent: number): void {
    // Leaving first person flies back from wherever the eye was.
    f.key = Number.NaN;
    if (!agentInWorld(agent)) return;
    const fx = Math.cos(r.pose.yaw);
    const fz = -Math.sin(r.pose.yaw);
    // Eyes ride up a ramp and through a jump with the agent.
    const lift = r.pose.elevation;
    camera.position.set(r.pose.x + fx * 0.5, EYE + lift, r.pose.z + fz * 0.5);
    f.look.set(camera.position.x + fx * 6, 0.9 + lift, camera.position.z + fz * 6);
    camera.lookAt(f.look);
  }

  const loose = mode === 'free';
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.09}
      screenSpacePanning={false}
      zoomToCursor={loose}
      maxPolarAngle={loose ? 1.48 : 1.5}
      minDistance={loose ? 1.2 : 2.5}
      maxDistance={700}
      onStart={() => void (r.follow.dragging = true)}
      onEnd={() => void (r.follow.dragging = false)}
    />
  );
}
