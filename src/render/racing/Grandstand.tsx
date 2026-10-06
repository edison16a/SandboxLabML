'use client';

import * as THREE from 'three';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { RUNOFF } from '@/engine/racing/car/runtime';
import { Rng } from '@/engine/core/rng';
import type { Track } from '@/engine/racing/track/types';
import { useDisposable } from '@/render/shared/useDisposable';
import { startPose } from './trackGeometry';

const ROWS = 6;
const LENGTH = 36;
const STEP = { depth: 1, rise: 0.55 };
/** Shirt colors for the crowd: muted, so the cars stay the brightest thing in view. */
const SHIRTS = ['#d9dde4', '#3c4658', '#8a96a8', '#c7533f', '#3f6fb5', '#e0b04a', '#5f8f5a', '#2a2f38'];

/**
 * Which side of the start line faces away from the circuit's middle. The
 * stand goes there, so it never ends up in the infield looking at the
 * back of the barriers.
 */
function outsideSign(track: Track): 1 | -1 {
  let mx = 0;
  let my = 0;
  for (let i = 0; i < track.count; i++) {
    mx += track.cx[i];
    my += track.cy[i];
  }
  mx /= track.count;
  my /= track.count;
  // Left of the start tangent, in track coordinates, is local -Z once drawn.
  const left = -track.ty[0] * (mx - track.cx[0]) + track.tx[0] * (my - track.cy[0]);
  return left > 0 ? 1 : -1;
}

/** Spots on the steps for spectators: most seats taken, a few gaps, the same crowd every time for a track. */
function seats(track: Track): Array<{ x: number; row: number; color: string; h: number }> {
  const rng = new Rng((Number.parseInt(track.hash, 16) || 7) ^ 0x5eed);
  const out: Array<{ x: number; row: number; color: string; h: number }> = [];
  for (let row = 0; row < ROWS; row++) {
    for (let x = -LENGTH / 2 + 0.6; x < LENGTH / 2 - 0.4; x += 0.72) {
      if (rng.next() < 0.72) out.push({ x: x + rng.range(-0.08, 0.08), row, color: SHIRTS[Math.floor(rng.next() * SHIRTS.length)], h: rng.range(0.92, 1.08) });
    }
  }
  return out;
}

/** A covered grandstand with a crowd, beside the start line on the outside of the track. */
export function Grandstand({ track }: { track: Track }) {
  const pose = startPose(track);
  const side = outsideSign(track);
  const offset = track.halfWidth + RUNOFF + 4.5;
  const crowd = useMemo(() => seats(track), [track]);
  const people = useRef<THREE.InstancedMesh>(null);
  const body = useDisposable(() => new THREE.CapsuleGeometry(0.2, 0.42, 3, 8).translate(0, 0.42, 0), []);

  useLayoutEffect(() => {
    const m = new THREE.Matrix4();
    const c = new THREE.Color();
    crowd.forEach((p, i) => {
      m.makeScale(1, p.h, 1).setPosition(p.x, (p.row + 1) * STEP.rise, p.row * STEP.depth + 0.55);
      people.current?.setMatrixAt(i, m);
      people.current?.setColorAt(i, c.set(p.color));
    });
    if (people.current) {
      people.current.instanceMatrix.needsUpdate = true;
      if (people.current.instanceColor) people.current.instanceColor.needsUpdate = true;
      people.current.computeBoundingSphere();
    }
  }, [crowd]);

  return (
    <group position={[pose.x, 0, pose.z]} rotation={[0, pose.yaw, 0]}>
      <group position={[0, 0, side * offset]} rotation={[0, side > 0 ? 0 : Math.PI, 0]}>
        {Array.from({ length: ROWS }, (_, row) => (
          <mesh key={row} position={[0, ((row + 1) * STEP.rise) / 2, row * STEP.depth + STEP.depth / 2]} castShadow receiveShadow>
            <boxGeometry args={[LENGTH, (row + 1) * STEP.rise, STEP.depth]} />
            <meshStandardMaterial color="#b4bac4" roughness={0.85} />
          </mesh>
        ))}
        <mesh position={[0, 2.6, ROWS * STEP.depth + 0.15]} castShadow receiveShadow>
          <boxGeometry args={[LENGTH, 5.2, 0.3]} />
          <meshStandardMaterial color="#2a2f38" roughness={0.6} />
        </mesh>
        {[-1, -0.5, 0, 0.5, 1].map((t) => (
          <mesh key={t} position={[(t * (LENGTH - 0.6)) / 2, 3.55, ROWS * STEP.depth]} castShadow>
            <boxGeometry args={[0.25, 7.1, 0.25]} />
            <meshStandardMaterial color="#2a2f38" metalness={0.6} roughness={0.35} />
          </mesh>
        ))}
        <mesh position={[0, 6.85, ROWS * STEP.depth / 2 - 0.4]} rotation={[-0.06, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[LENGTH + 1.2, 0.18, ROWS * STEP.depth + 2.2]} />
          <meshStandardMaterial color="#1b1f27" metalness={0.4} roughness={0.45} />
        </mesh>
        <mesh position={[0, 6.56, -1.5]}>
          <boxGeometry args={[LENGTH + 1.2, 0.14, 0.04]} />
          <meshStandardMaterial color="#4c9aff" emissive="#4c9aff" emissiveIntensity={2.2} toneMapped={false} />
        </mesh>
        <instancedMesh key={crowd.length} ref={people} args={[body, undefined, crowd.length]} castShadow>
          <meshStandardMaterial roughness={0.8} />
        </instancedMesh>
      </group>
    </group>
  );
}
