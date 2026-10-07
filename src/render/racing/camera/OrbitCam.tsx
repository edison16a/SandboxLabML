'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import { padOf, padWeight, type Pad } from '../stadium/layout';
import { terrainHeight } from '../world/terrain/terrainHeight';
import type { WorldData } from '../world/worldData';
import { useRacingScene } from '../sceneContext';

/** Roof height of the stands and the pits, m: a camera over their footprint stays above it. */
const ROOFS = { stand: 13.5, pit: 9.6 };

/** Each world's building footprints with their roof heights, worked out once. */
const footprints = new WeakMap<WorldData, Array<[Pad, number]>>();

function roofsOf(world: WorldData): Array<[Pad, number]> {
  let list = footprints.get(world);
  if (!list) {
    const l = world.layout;
    list = l.stands.map((s) => [padOf(l, l.side, s, 1), ROOFS.stand] as [Pad, number]);
    if (l.pit) list.push([padOf(l, -l.side, l.pit, 1), ROOFS.pit]);
    footprints.set(world, list);
  }
  return list;
}

/** Height of whatever is under (x, z): the ground, or a building's roof. */
function floorAt(world: WorldData, x: number, z: number): number {
  let floor = terrainHeight(world.shape, x, z);
  const roofs = roofsOf(world);
  // Plain index loop: this runs every frame and should not build iterators.
  for (let k = 0; k < roofs.length; k++) if (padWeight(roofs[k][0], x, z, 0.01) > 0.5) floor = Math.max(floor, roofs[k][1]);
  return floor;
}

/** Keeps a camera at least `margin` meters over the ground or roof beneath it, so it never sinks into a hill or a grandstand. */
export function keepAboveGround(camera: THREE.Camera, world: WorldData | null, margin: number): boolean {
  const ground = world ? floorAt(world, camera.position.x, camera.position.z) : 0;
  if (camera.position.y >= ground + margin) return false;
  camera.position.y = ground + margin;
  return true;
}

/**
 * A free orbit round the followed car: drag to turn, right drag or two
 * fingers to pan, wheel or pinch to zoom, all damped. The view rides along
 * with the car, so it stays framed however you have turned or panned, and
 * it never sinks under the hills.
 */
export function OrbitCam({ world, target }: { world: WorldData | null; target: React.RefObject<THREE.Vector3> }) {
  const { frame } = useRacingScene();
  const camera = useThree((s) => s.camera);
  const controls = useRef<React.ComponentRef<typeof OrbitControls>>(null);
  const last = useMemo(() => ({ pos: new THREE.Vector3(), ready: false }), []);

  useFrame(() => {
    const c = controls.current;
    if (!c) return;
    const focus = frame.focusPos;
    if (!last.ready) {
      // Opening shot: a three quarter view from behind and above, high enough to see the road ahead.
      const a = frame.focusYaw + Math.PI + 0.6;
      c.target.copy(focus).setY(0.8);
      camera.position.set(focus.x + Math.cos(a) * 15, 7.5, focus.z - Math.sin(a) * 15);
      last.ready = true;
    } else if (last.pos.distanceToSquared(focus) > 60 * 60) {
      // The focus jumped to another car: re-aim at it from the same angle.
      const offset = camera.position.clone().sub(c.target);
      c.target.copy(focus).setY(0.8);
      camera.position.copy(c.target).add(offset);
    } else {
      // Carry the whole rig along by however far the car moved, keeping the user's angle, zoom and pan.
      c.target.add(focus).sub(last.pos);
      camera.position.add(focus).sub(last.pos);
    }
    last.pos.copy(focus);
    c.update();
    keepAboveGround(camera, world, 1.2);
    target.current?.copy(c.target);
  });

  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      enablePan
      screenSpacePanning
      zoomSpeed={0.9}
      rotateSpeed={0.6}
      minDistance={3.5}
      maxDistance={420}
      maxPolarAngle={Math.PI * 0.49}
    />
  );
}
