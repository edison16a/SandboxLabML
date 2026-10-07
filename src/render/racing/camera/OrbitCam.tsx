'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { angleDelta } from '@/engine/core/math';
import { useEffect, useMemo } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { insideAt } from '../world/trackField';
import type { WorldData } from '../world/worldData';
import { useRacingScene } from '../sceneContext';
import { keepAboveGround } from './floor';
import { clearFraction } from './orbitBlockers';

const UP = new THREE.Vector3(0, 1, 0);

/** Share of the remaining glide after a drag that the orbit uses up each 60th of a second. */
const DAMPING = 0.07;

/**
 * Builds the orbit controls by hand rather than through drei's component,
 * which updates them in a frame callback of its own. The orbit carries the
 * rig along with the car before the controls update, and updating twice a
 * frame would also double the damping, so this owns the only update.
 */
function useOrbitControls(camera: THREE.Camera): OrbitControls {
  const gl = useThree((s) => s.gl);
  const events = useThree((s) => s.events);
  const set = useThree((s) => s.set);
  const get = useThree((s) => s.get);
  const controls = useMemo(() => {
    const c = new OrbitControls(camera);
    c.enableDamping = true;
    c.enablePan = true;
    c.screenSpacePanning = true;
    c.zoomSpeed = 0.9;
    c.rotateSpeed = 0.6;
    c.minDistance = 3.5;
    c.maxDistance = 420;
    c.maxPolarAngle = Math.PI * 0.49;
    return c;
  }, [camera]);
  useEffect(() => {
    controls.connect((events.connected as HTMLElement | undefined) ?? gl.domElement);
    // Other parts of the scene look for the active controls in the store, as with drei's makeDefault.
    const old = get().controls;
    set({ controls });
    return () => {
      set({ controls: old });
      controls.dispose();
    };
  }, [controls, events.connected, gl, get, set]);
  return controls;
}

/**
 * A free orbit round the followed car: drag to turn, right drag or two
 * fingers to pan, wheel or pinch to zoom, all damped the same at any frame
 * rate. The view rides and turns with the car, so the angle you chose
 * stays an angle on the car round the whole lap. It never sinks under the
 * hills, and slides in rather than look through the fence or a building.
 */
export function OrbitCam({ world, target }: { world: WorldData | null; target: React.RefObject<THREE.Vector3> }) {
  const { frame } = useRacingScene();
  const camera = useThree((s) => s.camera);
  const c = useOrbitControls(camera);
  const last = useMemo(() => ({ pos: new THREE.Vector3(), offset: new THREE.Vector3(), yaw: 0, arm: 0, ready: false, dragging: false }), []);
  useEffect(() => {
    const start = () => void (last.dragging = true);
    const end = () => void (last.dragging = false);
    c.addEventListener('start', start);
    c.addEventListener('end', end);
    return () => {
      c.removeEventListener('start', start);
      c.removeEventListener('end', end);
    };
  }, [c, last]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.25);
    const focus = frame.focusPos;
    const turn = angleDelta(last.yaw, frame.focusYaw);
    last.yaw = frame.focusYaw;
    if (!last.ready) {
      // Opening shot: a three quarter view from behind and above. It takes the infield side, where no
      // grandstand fence stands between the lens and the car.
      let a = frame.focusYaw + Math.PI + 0.6;
      if (world && !insideAt(world.field, focus.x + Math.cos(a) * 14, focus.z - Math.sin(a) * 14)) a -= 1.2;
      c.target.copy(focus).setY(0.8);
      camera.position.set(focus.x + Math.cos(a) * 14, 5.5, focus.z - Math.sin(a) * 14);
      last.arm = camera.position.distanceTo(c.target);
      last.ready = true;
    } else {
      // Carry the rig with the car: moved by however far it went (re-aimed if the focus jumped to another
      // car), and turned with it unless the user is dragging, so the chosen angle stays an angle on the car.
      last.offset.copy(camera.position).sub(c.target);
      if (last.pos.distanceToSquared(focus) > 60 * 60) c.target.copy(focus).setY(0.8);
      else c.target.add(focus).sub(last.pos);
      if (!last.dragging) last.offset.applyAxisAngle(UP, turn);
      // Back out to the distance the user chose, in case a building pulled the camera in last frame.
      camera.position.copy(c.target).addScaledVector(last.offset, last.arm / Math.max(1e-3, last.offset.length()));
    }
    last.pos.copy(focus);
    // The controls damp by a fixed share per update; scale it so a glide lasts as long at 30 or 144 frames per second.
    c.dampingFactor = 1 - Math.pow(1 - DAMPING, dt * 60);
    c.update();
    last.arm = camera.position.distanceTo(c.target);
    if (world) {
      // Never look through the catch fence or a building: slide in along the line to just short of it.
      const t = clearFraction(world, c.target, camera.position);
      if (t < 1) camera.position.lerpVectors(c.target, camera.position, Math.max(t - 0.04, c.minDistance / Math.max(last.arm, 1e-3)));
    }
    keepAboveGround(camera, world, 1.2);
    target.current?.copy(c.target);
  });

  return null;
}
