'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import { RUNOFF } from '@/engine/racing/car/runtime';
import { gridSlot, slotPose } from '@/engine/racing/car/startGrid';
import type { Track } from '@/engine/racing/track/types';
import { checkerTexture } from '@/render/shared/textures';
import { useDisposable } from '@/render/shared/useDisposable';
import { brandTexture } from '../stadium/brandTexture';
import { startPose } from '../trackGeometry';
import { withHaze } from '../world/atmosphere';

/** Painted grid boxes behind the line, matching the Sandbox's staggered grid slots. */
const GRID_BOXES = 12;

/** One merged mesh of white grid marks: a bar across each slot's nose and two short ticks back along its sides. */
function gridMarks(track: Track): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  for (let slot = 1; slot <= GRID_BOXES; slot++) {
    const pose = slotPose(track, gridSlot(track, slot));
    const bar = new THREE.PlaneGeometry(0.2, 2.5).rotateX(-Math.PI / 2).translate(2.7, 0, 0);
    const left = new THREE.PlaneGeometry(1.1, 0.14).rotateX(-Math.PI / 2).translate(2.2, 0, -1.18);
    const right = new THREE.PlaneGeometry(1.1, 0.14).rotateX(-Math.PI / 2).translate(2.2, 0, 1.18);
    for (const g of [bar, left, right]) {
      g.rotateY(pose.heading).translate(pose.x, 0.02, -pose.y);
      parts.push(g);
    }
  }
  const merged = new THREE.BufferGeometry();
  const pos = parts.flatMap((p) => Array.from(p.toNonIndexed().attributes.position.array));
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  merged.computeVertexNormals();
  parts.forEach((p) => p.dispose());
  return merged;
}

/**
 * The start and finish: a checkered band across the road, the painted grid
 * behind it, and an overhead gantry carrying the lab's board and the five
 * start lights.
 */
export function StartLine({ track, paint }: { track: Track; paint: THREE.Material }) {
  const p = startPose(track);
  const w = track.halfWidth * 2;
  const span = w + RUNOFF * 2 + 4.4;
  const marks = useDisposable(() => gridMarks(track), [track]);
  const look = useDisposable(() => {
    const checker = checkerTexture(10);
    checker.repeat.set(1, w / 1.6);
    const board = brandTexture('dark', 7);
    const steel = withHaze(new THREE.MeshStandardMaterial({ color: '#2b3038', metalness: 0.7, roughness: 0.38 }));
    const line = withHaze(new THREE.MeshStandardMaterial({ map: checker, roughness: 0.65, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }));
    const face = withHaze(new THREE.MeshStandardMaterial({ map: board, roughness: 0.4, emissive: '#ffffff', emissiveMap: board, emissiveIntensity: 0.35 }));
    const lamp = withHaze(new THREE.MeshStandardMaterial({ color: '#1a0505', emissive: '#ff2414', emissiveIntensity: 0.06, roughness: 0.25, metalness: 0.2 }));
    const all = [checker, board, steel, line, face, lamp];
    return { steel, line, face, lamp, dispose: () => all.forEach((x) => x.dispose()) };
  }, [w]);
  const lamps = useMemo(() => [-2, -1, 0, 1, 2].map((k) => k * 0.42), []);

  return (
    <group>
      <mesh geometry={marks} material={paint} receiveShadow />
      <group position={[p.x, 0, p.z]} rotation={[0, p.yaw, 0]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.022, 0]} material={look.line} receiveShadow>
          <planeGeometry args={[1.6, w]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[0, 3.7, (s * span) / 2]} material={look.steel} castShadow>
            <boxGeometry args={[0.7, 7.4, 0.7]} />
          </mesh>
        ))}
        <mesh position={[0, 7.1, 0]} material={look.steel} castShadow>
          <boxGeometry args={[0.9, 0.7, span + 0.7]} />
        </mesh>
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.36, 6.15, 0]} rotation={[0, s > 0 ? Math.PI / 2 : -Math.PI / 2, 0]} material={look.face}>
            <planeGeometry args={[w * 0.6, (w * 0.6) / 7]} />
          </mesh>
        ))}
        {lamps.map((z) => (
          <mesh key={z} position={[-0.47, 7.1, z]} rotation={[0, 0, Math.PI / 2]} material={look.lamp}>
            <cylinderGeometry args={[0.13, 0.13, 0.06, 18]} />
          </mesh>
        ))}
      </group>
    </group>
  );
}
