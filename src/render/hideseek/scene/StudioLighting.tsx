'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Environment, Lightformer } from '@react-three/drei';
import { useEffect, useMemo, useRef } from 'react';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import { useHsScene } from '../frame/sceneContext';
import { arenaOrigin } from '../layout/gridLattice';
import { HS_COLORS } from '../palette';

/** Key light direction: high and from the front left, so walls throw readable shadows into the room. */
const KEY = new THREE.Vector3(-0.55, 1, 0.42).normalize();
/** Half the shadow box: the 20 m arena plus its walls and a little margin, so all 2048 texels land on the room. */
const SHADOW_HALF = 11.5;

/**
 * Daylight for every tier. Image based lighting comes from a small sky
 * built out of drei Lightformers (a broad overhead softbox, a cool sky fill
 * and a warm bounce) rendered once into an environment map, so there is no
 * HDR file. One warm sun casts soft shadows, fitted tightly to the focused
 * arena, and a pale haze swallows the far backdrop.
 */
export function StudioLighting({ tier, shadows }: { tier: HsQualityTier; shadows: boolean }) {
  const { frame } = useHsScene();
  const gl = useThree((s) => s.gl);
  const light = useRef<THREE.DirectionalLight>(null);
  const target = useMemo(() => new THREE.Object3D(), []);
  const origin = useMemo(() => ({ x: 0, z: 0 }), []);
  const mapSize = tier === 'ultra' ? 4096 : tier === 'high' ? 2048 : 1024;

  useEffect(() => {
    // Shadow maps are redrawn by hand once a frame. Left automatic, every
    // render call (each first person view, the contact shadow pass) would
    // redraw them again.
    gl.shadowMap.autoUpdate = false;
    return () => {
      gl.shadowMap.autoUpdate = true;
    };
  }, [gl]);

  useFrame(() => {
    gl.shadowMap.needsUpdate = true;
    const l = light.current;
    if (!l) return;
    if (frame.focusSlot >= 0) arenaOrigin(frame.focusSlot, frame.lattice, origin);
    else origin.x = origin.z = 0;
    target.position.set(origin.x, 0, origin.z);
    target.updateMatrixWorld();
    l.position.set(origin.x + KEY.x * 40, KEY.y * 40, origin.z + KEY.z * 40);
  });

  return (
    <>
      <color attach="background" args={[HS_COLORS.background]} />
      <fog attach="fog" args={[HS_COLORS.background, 160, 620]} />
      <hemisphereLight args={['#eef3fb', '#e2ded8', 0.45]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={2.9}
        color="#fff9f2"
        castShadow={shadows}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.025}
        shadow-radius={tier === 'ultra' ? 7 : 5}
        shadow-camera-left={-SHADOW_HALF}
        shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF}
        shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-near={10}
        shadow-camera-far={80}
      />
      <Environment resolution={tier === 'low' ? 64 : 256} frames={1} environmentIntensity={0.45}>
        <color attach="background" args={['#cfd5dc']} />
        <Lightformer form="rect" intensity={2.6} color="#ffffff" position={[0, 10, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[22, 22, 1]} />
        <Lightformer form="rect" intensity={1.3} color="#e6eeff" position={[-12, 4, -3]} rotation={[0, Math.PI / 2, 0]} scale={[18, 5, 1]} />
        <Lightformer form="rect" intensity={1.0} color="#ffe9d2" position={[12, 3, 4]} rotation={[0, -Math.PI / 2, 0]} scale={[16, 4, 1]} />
        <Lightformer form="rect" intensity={0.8} color="#f4ede4" position={[0, -2, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[30, 30, 1]} />
      </Environment>
    </>
  );
}
