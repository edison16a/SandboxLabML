'use client';

import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useEffect } from 'react';
import type { NavQualityTier } from '../types';

/**
 * Post processing on High and Ultra:
 * N8AO grounds the crates and runners, bloom lifts only emissive parts
 * (the finish glow, the ring, sensor hits), neutral tone mapping keeps the
 * whites white, SMAA cleans edges and a light vignette frames the view.
 * The scene buffer keeps a stencil for the champion's silhouette.
 */
export function NavEffects({ tier }: { tier: NavQualityTier }) {
  const ultra = tier === 'ultra';
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} stencilBuffer frameBufferType={THREE.HalfFloatType}>
      <N8AO ref={opaqueOnly} aoRadius={1.8} distanceFalloff={1.1} intensity={2.6} quality={ultra ? 'high' : 'medium'} halfRes={!ultra} color="#05070b" />
      <Bloom mipmapBlur levels={ultra ? 7 : 5} luminanceThreshold={1.5} luminanceSmoothing={0.2} intensity={0.9} radius={0.6} />
      <ToneMapping mode={ToneMappingMode.NEUTRAL} />
      <SMAA />
      <Vignette eskil={false} offset={0.32} darkness={0.34} />
    </EffectComposer>
  );
}

/** Occlusion from opaque geometry only: N8AO's own transparency mode renders the scene twice more and stamps decals into the shade. */
function opaqueOnly(pass: { autoDetectTransparency: boolean; configuration: { transparencyAware: boolean } } | null): void {
  if (!pass) return;
  pass.autoDetectTransparency = false;
  pass.configuration.transparencyAware = false;
}

/**
 * The renderer tone maps unless the effect composer does it, in which case
 * it must hand over linear colors. Neutral keeps whites white and the
 * runner blue true, where AgX would grey a bright daylight scene down.
 */
export function ToneMappingSync({ composer }: { composer: boolean }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    gl.toneMapping = composer ? THREE.NoToneMapping : THREE.NeutralToneMapping;
    gl.toneMappingExposure = 1;
    invalidate();
  }, [gl, composer, invalidate]);
  return null;
}

/** Pixel ratio range per tier: resolution is the first thing a cheaper tier gives up. */
export function navDpr(tier: NavQualityTier): [number, number] {
  if (tier === 'low') return [1, 1];
  if (tier === 'medium') return [1, 1.5];
  if (tier === 'high') return [1, 2];
  return [1, 3];
}
