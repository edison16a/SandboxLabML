'use client';

import * as THREE from 'three';
import { Bloom, EffectComposer, N8AO, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useDisposable } from '@/render/shared/useDisposable';
import { TIERS, type DrivingTier } from '../quality';
import { GradeEffect } from './grade';

/**
 * N8AO turns on a transparency mode by itself as soon as the scene holds a
 * transparent material, which this scene always does (ghosts, sensor
 * overlays, glow cards). That mode renders the scene twice more and stamps
 * the overlays into the occlusion, so only opaque geometry darkens corners.
 */
function opaqueOnly(pass: { autoDetectTransparency: boolean; configuration: { transparencyAware: boolean } } | null): void {
  if (!pass) return;
  pass.autoDetectTransparency = false;
  pass.configuration.transparencyAware = false;
}

/**
 * Post effects. Medium and up ground the city with ambient occlusion where
 * walls meet sidewalks and cars meet the road; High adds bloom on signals,
 * lamps and brake lights, a warm grade, edge smoothing and a light
 * vignette. Low skips the composer and tone maps in the renderer.
 */
export function CityEffects({ tier }: { tier: DrivingTier }) {
  const grade = useDisposable(() => new GradeEffect(), []);
  const look = TIERS[tier];
  if (!look.post) return null;
  const ultra = tier === 'ultra';
  const high = tier === 'high' || ultra;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false} frameBufferType={THREE.HalfFloatType}>
      <N8AO ref={opaqueOnly} aoRadius={1.2} distanceFalloff={1} intensity={high ? 2.4 : 2} quality={ultra ? 'high' : high ? 'medium' : 'low'} halfRes={!ultra} color="#0a0c10" />
      <Bloom mipmapBlur levels={ultra ? 7 : 6} luminanceThreshold={1.1} luminanceSmoothing={0.25} intensity={high ? 0.85 : 0.6} radius={0.65} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <primitive object={grade} />
      <SMAA />
      <Vignette eskil={false} offset={0.3} darkness={0.34} />
    </EffectComposer>
  );
}
