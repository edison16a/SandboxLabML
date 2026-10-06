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
 * Lights for both tiers. Image based lighting comes from a small studio
 * built out of drei Lightformers (a ceiling softbox, side strips and a warm
 * kicker) rendered once into an environment map, so there is no HDR file.
 * One key light casts soft shadows, fitted tightly to the focused arena.
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
      <fog attach="fog" args={[HS_COLORS.background, 220, 900]} />
      <hemisphereLight args={['#dfe7f5', '#141922', 0.3]} />
      <primitive object={target} />
      <directionalLight
        ref={light}
        target={target}
        intensity={2.9}
        color="#fff4e6"
        castShadow={shadows}
        shadow-mapSize={[mapSize, mapSize]}
        shadow-bias={-0.00025}
        shadow-normalBias={0.025}
        shadow-radius={tier === 'ultra' ? 6 : 4}
        shadow-camera-left={-SHADOW_HALF}
        shadow-camera-right={SHADOW_HALF}
        shadow-camera-top={SHADOW_HALF}
        shadow-camera-bottom={-SHADOW_HALF}
        shadow-camera-near={10}
        shadow-camera-far={80}
      />
      <Environment resolution={tier === 'low' ? 64 : 256} frames={1} environmentIntensity={0.55}>
        <color attach="background" args={['#0c1017']} />
        <Lightformer form="rect" intensity={2.4} color="#f4f7ff" position={[0, 9, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[16, 16, 1]} />
        <Lightformer form="rect" intensity={1.2} color="#dfe8ff" position={[-10, 4, -2]} rotation={[0, Math.PI / 2, 0]} scale={[14, 3, 1]} />
        <Lightformer form="rect" intensity={0.9} color="#ffe2c4" position={[10, 3, 3]} rotation={[0, -Math.PI / 2, 0]} scale={[12, 2, 1]} />
        <Lightformer form="ring" intensity={1.4} color="#ffffff" position={[3, 6, 9]} scale={3} />
      </Environment>
    </>
  );
}
