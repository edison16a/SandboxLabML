'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';
import { useHsScene } from '../frame/sceneContext';
import { followedAgent } from '../frame/followedAgent';
import { boxDrag } from '../interaction/useBoxDrag';
import { arenaOrigin, ARENA_SPAN } from '../layout/gridLattice';
import { cityEdgeFrom, farPlane, hazeRange } from '../scene/haze';
import { arenaShot, easeInOutCubic, overviewShot, type Shot } from './framing';

/** How long a change of focus takes to fly, s. */
const FLY_SECONDS = 0.5;
/** Eye height of the first person cameras, m: just under the top of a 1.6 m agent. */
const EYE = 1.32;

type Controls = React.ComponentRef<typeof OrbitControls>;

/**
 * Orbit and top down cameras with damping, a 500 ms fly whenever the focus
 * or the framing changes, and first person cameras that ride on the hider
 * or the seeker of the focused arena.
 */
export function CameraRig() {
  const { frame } = useHsScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const size = useThree((s) => s.size);
  const invalidate = useThree((s) => s.invalidate);
  const scene = useThree((s) => s.scene);
  const controls = useRef<Controls>(null);
  const fly = useMemo(
    () => ({ key: Number.NaN, started: false, t: 1, fromPos: new THREE.Vector3(), fromTarget: new THREE.Vector3(), toPos: new THREE.Vector3(), toTarget: new THREE.Vector3(), o: { x: 0, z: 0 }, pose: { x: 0, z: 0, yaw: 0, elevation: 0 }, look: new THREE.Vector3(), haze: { near: 0, far: 0 } }),
    [],
  );

  useFrame((_, dt) => {
    const c = controls.current;
    const mode = useHideSeekLab.getState().camera;
    const pov = mode === 'seeker' || mode === 'hider';
    if (c) c.enabled = !pov && fly.t >= 1 && !boxDrag.active;
    const target = c?.target ?? fly.toTarget;
    fitDepthRanges(pov ? 0 : camera.position.distanceTo(target), target);
    if (pov) return firstPerson(mode === 'seeker' ? 1 : 0);
    const key = (frame.focusSlot + 1) * 1e6 + frame.count * 1e4 + frame.lattice.cols * 10 + (mode === 'top' ? 1 : 0);
    if (key !== fly.key) {
      fly.key = key;
      const aspect = size.width / Math.max(1, size.height);
      const shot = frame.focusSlot >= 0 ? focusShot(aspect, mode === 'top') : overviewShot(frame.lattice, camera.fov, aspect, mode === 'top');
      fly.fromPos.copy(camera.position);
      fly.fromTarget.copy(c?.target ?? fly.toTarget);
      fly.toPos.set(shot.px, shot.py, shot.pz);
      fly.toTarget.set(shot.tx, shot.ty, shot.tz);
      // The very first framing jumps; later ones fly.
      fly.t = fly.started ? 0 : 1;
      fly.started = true;
      if (fly.t >= 1) {
        camera.position.copy(fly.toPos);
        c?.target.copy(fly.toTarget);
        camera.lookAt(fly.toTarget);
        c?.update();
      }
    }
    if (fly.t < 1) {
      fly.t = Math.min(1, fly.t + Math.min(dt, 0.1) / FLY_SECONDS);
      const e = easeInOutCubic(fly.t);
      camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
      fly.look.lerpVectors(fly.fromTarget, fly.toTarget, e);
      c?.target.copy(fly.look);
      camera.lookAt(fly.look);
      c?.update();
      invalidate();
    }
  });

  /**
   * Near and far planes follow the viewing distance. Depth precision is
   * spread between them, so a near plane fit for first person views would
   * make the thin floor markings flicker when seen from 200 m away. The
   * haze follows it too, so the city fades out from any orbit, and the far
   * plane always lies past the end of the haze.
   */
  function fitDepthRanges(distance: number, target: THREE.Vector3): void {
    const fog = scene.fog as THREE.Fog | null;
    if (fog) {
      hazeRange(distance, cityEdgeFrom(target.x, target.z, frame.lattice.width / 2, frame.lattice.depth / 2), fly.haze);
      fog.near = fly.haze.near;
      fog.far = fly.haze.far;
    }
    const near = THREE.MathUtils.clamp(distance * 0.012, 0.05, 4);
    const far = farPlane(distance);
    if (Math.abs(camera.near - near) > near * 0.1 || Math.abs(camera.far - far) > far * 0.1) {
      camera.near = near;
      camera.far = far;
      camera.updateProjectionMatrix();
    }
  }

  function focusShot(aspect: number, top: boolean): Shot {
    arenaOrigin(frame.focusSlot, frame.lattice, fly.o);
    return arenaShot(fly.o.x, fly.o.z, ARENA_SPAN, camera.fov, aspect, top);
  }

  function firstPerson(agent: number): void {
    const slot = Math.max(0, frame.focusSlot);
    if (followedAgent(frame, slot, agent, fly.pose) < 0) return;
    arenaOrigin(slot, frame.lattice, fly.o);
    const fx = Math.cos(fly.pose.yaw);
    const fz = -Math.sin(fly.pose.yaw);
    // Eyes ride up a ramp and through a jump with the agent.
    const lift = fly.pose.elevation;
    camera.position.set(fly.o.x + fly.pose.x + fx * 0.5, EYE + lift, fly.o.z + fly.pose.z + fz * 0.5);
    fly.look.set(camera.position.x + fx * 6, 0.9 + lift, camera.position.z + fz * 6);
    camera.lookAt(fly.look);
    // Leaving first person flies back from wherever the eye was.
    fly.key = Number.NaN;
  }

  return <OrbitControls ref={controls} makeDefault enableDamping dampingFactor={0.09} maxPolarAngle={Math.PI / 2.05} minDistance={3} maxDistance={700} />;
}
