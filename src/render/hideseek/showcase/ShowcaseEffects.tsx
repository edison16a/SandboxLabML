'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Bloom, DepthOfField, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useMemo } from 'react';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import { useHsScene } from '../frame/sceneContext';
import { arenaOrigin } from '../layout/gridLattice';

/**
 * Post-processing for the showcase: N8AO ambient occlusion grounds the
 * crates and agents, bloom lifts only emissive parts (anything pushed past
 * 1), neutral tone mapping keeps the whites white and the team colors
 * true, SMAA cleans edges and a light vignette frames the room. Photo mode adds depth
 * of field focused on the arena.
 */
export function ShowcaseEffects({ tier, photo }: { tier: HsQualityTier; photo: boolean }) {
  const ultra = tier === 'ultra';
  const ao = <N8AO ref={opaqueOnly} aoRadius={1.8} distanceFalloff={1.1} intensity={2.8} quality={ultra ? 'high' : 'medium'} halfRes={!ultra} color="#05070b" />;
  // Lit white walls reach a little past 1 in linear light, so the threshold sits above them and only emissive parts glow.
  const bloom = <Bloom mipmapBlur levels={ultra ? 7 : 5} luminanceThreshold={1.5} luminanceSmoothing={0.2} intensity={0.9} radius={0.6} />;
  const finish = [<ToneMapping key="tm" mode={ToneMappingMode.NEUTRAL} />, <SMAA key="smaa" />, <Vignette key="v" eskil={false} offset={0.32} darkness={0.36} />];
  return photo ? (
    <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
      {ao}
      {bloom}
      <FocusedDof />
      {finish}
    </EffectComposer>
  ) : (
    <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
      {ao}
      {bloom}
      {finish}
    </EffectComposer>
  );
}

/**
 * N8AO turns on a transparency mode by itself as soon as the scene holds a
 * transparent material, which this scene always does (cones, trails, blob
 * shadows). That mode renders the scene twice more and stamped ghost
 * outlines of floor decals into the occlusion, so it is switched off: only
 * opaque geometry should darken corners.
 */
function opaqueOnly(pass: { autoDetectTransparency: boolean; configuration: { transparencyAware: boolean } } | null): void {
  if (!pass) return;
  pass.autoDetectTransparency = false;
  pass.configuration.transparencyAware = false;
}

/** Depth of field with its focus on the center of the focused arena. */
function FocusedDof() {
  const { frame } = useHsScene();
  const target = useMemo(() => new THREE.Vector3(), []);
  const o = useMemo(() => ({ x: 0, z: 0 }), []);
  useFrame(() => {
    if (frame.focusSlot < 0) return;
    arenaOrigin(frame.focusSlot, frame.lattice, o);
    target.set(o.x, 0.6, o.z);
  });
  return <DepthOfField target={target} focusRange={9} bokehScale={4.5} resolutionScale={0.5} />;
}
