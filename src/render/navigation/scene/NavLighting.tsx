'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import { HAZE } from '@/render/hideseek/scene/haze';
import { NAV_COLORS } from '../palette';
import type { NavQualityTier } from '../types';
import { KEY, snapShadowTarget } from './shadowSnap';

/** Smallest and largest half size of the shadow box, m. It grows with the view so a close shot gets crisp shadows and an overview gets all of them. */
const SHADOW_MIN = 9;
const SHADOW_MAX = 30;
/** The box size snaps to steps this big, m, and its center to whole texels of the map, so shadows never crawl as the camera moves. */
const SIZE_STEP = 3;

/**
 * Daylight for every tier, the Hide and Seek studio sky: image based light
 * from a few drei Lightformers rendered once into an environment map, one
 * warm sun with soft shadows and a pale haze. The courses are long, so the
 * sun's shadow box follows the point the camera orbits and grows with the
 * viewing distance, snapped so the shadows stay still.
 */
export function NavLighting({ tier, shadows }: { tier: NavQualityTier; shadows: boolean }) {
  const gl = useThree((s) => s.gl);
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const mapSize = tier === 'ultra' ? 4096 : tier === 'high' ? 2048 : 1024;
  const state = useMemo(() => ({ half: 0 }), []);

  useEffect(() => {
    // Shadow maps are redrawn by hand once a frame, not on every render call (the contact shadows render too).
    gl.shadowMap.autoUpdate = false;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  useFrame(({ camera, controls }) => {
    gl.shadowMap.needsUpdate = true;
    const l = light.current;
    if (!l) return;
    const aim = (controls as unknown as { target?: THREE.Vector3 } | null)?.target;
    const ax = aim?.x ?? 0;
    const az = aim?.z ?? 0;
    const distance = aim ? camera.position.distanceTo(aim) : 30;
    const half = THREE.MathUtils.clamp(Math.ceil((distance * 0.75) / SIZE_STEP) * SIZE_STEP, SHADOW_MIN, SHADOW_MAX);
    const cam = l.shadow.camera;
    if (half !== state.half) {
      state.half = half;
      cam.left = cam.bottom = -half;
      cam.right = cam.top = half;
      cam.updateProjectionMatrix();
    }
    const t = snapShadowTarget(ax, az, (2 * half) / mapSize, target.position);
    target.updateMatrixWorld();
    l.position.set(t.x + KEY.x * 40, t.y + KEY.y * 40, t.z + KEY.z * 40);
  });

  return (
    <>
      <color attach="background" args={[NAV_COLORS.background]} />
      <fog attach="fog" args={[NAV_COLORS.background, HAZE.near, HAZE.far]} />
      <hemisphereLight args={['#eef3fb', '#aeb5bf', 0.5]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={2.7}
        color="#fff7ee"
        castShadow={shadows}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.025}
        shadow-radius={tier === 'ultra' ? 7 : 5}
        shadow-camera-near={10}
        shadow-camera-far={90}
      />
      <Environment resolution={tier === 'low' ? 64 : 256} frames={1} environmentIntensity={0.34}>
        <color attach="background" args={['#c4cad2']} />
        <Lightformer form="rect" intensity={2.4} color="#ffffff" position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[22, 22, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#e4ecff" position={[-12, 4, -3]} rotation={[0, Math.PI / 2, 0]} scale={[18, 5, 1]} />
        <Lightformer form="rect" intensity={0.55} color="#ffe9d2" position={[12, 3, 4]} rotation={[0, -Math.PI / 2, 0]} scale={[16, 4, 1]} />
        <Lightformer form="rect" intensity={0.5} color="#eef0f3" position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
      </Environment>
    </>
  );
}
