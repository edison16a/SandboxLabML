'use client';

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Course } from '@/engine/navigation/course/build';
import { groundedMaterial } from '@/render/hideseek/room/groundedMaterial';
import { useDisposable } from '@/render/shared/useDisposable';
import { NAV_COLORS } from '../palette';
import { checkerMaterial } from './checkerMaterial';
import { curtainMaterial } from './finishCurtain';

/** The arch: pillar size and height, and the beam's depth and height, m. */
const PILLAR = 0.42;
const HEIGHT = 3.1;
const BEAM = 0.56;
/** Depth of the checkered band on the floor, m, starting at the line. */
const BAND = 0.9;
/** The glow strip under the beam, pushed past 1 so bloom catches it. */
const GLOW = new THREE.Color(NAV_COLORS.finishGlow).multiplyScalar(2.6);

/**
 * The finish: a clean arch across the course at the line, light grey
 * pillars carrying a beam with a checkered band and a glowing strip under
 * it, a checkered band on the floor past the line, and a faint wash of
 * light rising from the line itself so the gate reads from far away.
 */
export function FinishGate({ course, shadows }: { course: Course; shadows: boolean }) {
  const w = course.spec.width;
  const x = course.finishX;
  const pillar = useDisposable(() => new RoundedBoxGeometry(PILLAR, HEIGHT, PILLAR, 2, 0.04).translate(0, HEIGHT / 2, 0), []);
  const beam = useDisposable(() => new RoundedBoxGeometry(PILLAR + 0.04, BEAM, w + PILLAR, 2, 0.04), [w]);
  const pillarMat = useDisposable(() => groundedMaterial({ color: NAV_COLORS.wall, roughness: 0.5, metalness: 0, envMapIntensity: 0.7 }, 0.8, 0.8), []);
  // Two rows of checks down each long face of the beam; its top and ends stay dark.
  const beamMat = useDisposable(() => checkerMaterial(BEAM / 2, 'vec2(p.z, p.y)', 'abs(n.x) > 0.5', { roughness: 0.4 }), []);
  // Two rows of checks across the floor, from the line toward the end wall.
  const bandMat = useDisposable(() => checkerMaterial(BAND / 2, 'vec2(p.x, p.y)', 'true', { roughness: 0.3, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), []);
  const glowMat = useDisposable(() => new THREE.MeshBasicMaterial({ color: GLOW, toneMapped: false }), []);
  const curtain = useDisposable(() => curtainMaterial(), []);
  const half = w / 2 - PILLAR / 2 - 0.02;
  return (
    <group position={[x, 0, 0]}>
      <mesh geometry={pillar} material={pillarMat} position={[0, 0, -half]} castShadow={shadows} receiveShadow={shadows} />
      <mesh geometry={pillar} material={pillarMat} position={[0, 0, half]} castShadow={shadows} receiveShadow={shadows} />
      <mesh geometry={beam} material={beamMat} position={[0, HEIGHT + BEAM / 2 - 0.12, 0]} castShadow={shadows} receiveShadow={shadows} />
      <mesh material={glowMat} position={[0, HEIGHT - 0.15, 0]} raycast={() => null}>
        <boxGeometry args={[0.16, 0.05, w - PILLAR * 2]} />
      </mesh>
      <mesh material={bandMat} position={[BAND / 2, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow={shadows} raycast={() => null}>
        <planeGeometry args={[BAND, w, 1, 1]} />
      </mesh>
      <mesh material={glowMat} position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
        <planeGeometry args={[0.07, w]} />
      </mesh>
      <mesh material={curtain} position={[0, 1.1, 0]} rotation={[0, Math.PI / 2, 0]} renderOrder={2} raycast={() => null}>
        <planeGeometry args={[w - PILLAR * 2, 2.2]} />
      </mesh>
    </group>
  );
}
