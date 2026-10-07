'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { insideAt } from '../world/trackField';
import type { WorldData } from '../world/worldData';
import { useRacingScene } from '../sceneContext';
import { keepAboveGround } from './floor';

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
 * rate. The view rides along with the car, so it stays framed however you
 * have turned or panned, and it never sinks under the hills.
 */
export function OrbitCam({ world, target }: { world: WorldData | null; target: React.RefObject<THREE.Vector3> }) {
  const { frame } = useRacingScene();
  const camera = useThree((s) => s.camera);
  const c = useOrbitControls(camera);
  const last = useMemo(() => ({ pos: new THREE.Vector3(), offset: new THREE.Vector3(), ready: false }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.25);
    const focus = frame.focusPos;
    if (!last.ready) {
      // Opening shot: a three quarter view from behind and above. It takes the infield side, where no
      // grandstand fence stands between the lens and the car.
      let a = frame.focusYaw + Math.PI + 0.6;
      if (world && !insideAt(world.field, focus.x + Math.cos(a) * 14, focus.z - Math.sin(a) * 14)) a -= 1.2;
      c.target.copy(focus).setY(0.8);
      camera.position.set(focus.x + Math.cos(a) * 14, 5.5, focus.z - Math.sin(a) * 14);
      last.ready = true;
    } else if (last.pos.distanceToSquared(focus) > 60 * 60) {
      // The focus jumped to another car: re-aim at it from the same angle.
      last.offset.copy(camera.position).sub(c.target);
      c.target.copy(focus).setY(0.8);
      camera.position.copy(c.target).add(last.offset);
    } else {
      // Carry the whole rig along by however far the car moved, keeping the user's angle, zoom and pan.
      c.target.add(focus).sub(last.pos);
      camera.position.add(focus).sub(last.pos);
    }
    last.pos.copy(focus);
    // The controls damp by a fixed share per update; scale it so a glide lasts as long at 30 or 144 frames per second.
    c.dampingFactor = 1 - Math.pow(1 - DAMPING, dt * 60);
    c.update();
    keepAboveGround(camera, world, 1.2);
    target.current?.copy(c.target);
  });

  return null;
}
