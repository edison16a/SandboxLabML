'use client';

import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import type { QualityTier } from '@/features/racing/state/labStore';

/**
 * Post-processing for the High tier only: SMAA, bloom on emissive parts (brake
 * lights, gantry strip), ACES tone mapping and a light vignette. Lower tiers
 * skip the composer entirely and let the renderer tone map directly.
 */
export function Effects({ tier }: { tier: QualityTier }) {
  if (tier !== 'high') return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.2} intensity={0.85} radius={0.55} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <SMAA />
      <Vignette eskil={false} offset={0.25} darkness={0.42} />
    </EffectComposer>
  );
}
