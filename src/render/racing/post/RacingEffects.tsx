'use client';

import { useFrame } from '@react-three/fiber';
import { Bloom, EffectComposer, SMAA, ToneMapping, Vignette } from '@react-three/postprocessing';
import { ToneMappingMode } from 'postprocessing';
import { useMemo } from 'react';
import type { QualityTier } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import { useRacingScene } from '../sceneContext';
import { GradeEffect, SpeedBlurEffect } from './raceEffects';

/** Speed where the blur reaches full strength, m/s. */
const TOP = 35;

/**
 * Post effects for the High tier: bloom on the sun and lamps, a radial
 * speed blur in the chase view, ACES tone mapping, a warm grade, SMAA and a
 * light vignette. Lower tiers skip the composer entirely and tone map in
 * the renderer, which keeps 100 cars smooth on modest GPUs.
 */
export function RacingEffects({ tier, chase }: { tier: QualityTier; chase: boolean }) {
  const { frame } = useRacingScene();
  const blur = useDisposable(() => new SpeedBlurEffect(), []);
  const grade = useDisposable(() => new GradeEffect(), []);
  const state = useMemo(() => ({ strength: 0 }), []);

  useFrame((_, dt) => {
    const pace = Math.min(1, Math.max(0, (frame.focusSpeed - 12) / (TOP - 12)));
    const want = chase ? 0.05 * pace * pace : 0;
    // Ease toward the target so a camera cut or a crash does not pop the blur.
    state.strength += (want - state.strength) * Math.min(1, dt * 4);
    blur.strength = state.strength;
  });

  if (tier !== 'high') return null;
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom mipmapBlur luminanceThreshold={1.05} luminanceSmoothing={0.2} intensity={0.7} radius={0.6} />
      <primitive object={blur} />
      <ToneMapping mode={ToneMappingMode.ACES_FILMIC} />
      <primitive object={grade} />
      <SMAA />
      <Vignette eskil={false} offset={0.28} darkness={0.38} />
    </EffectComposer>
  );
}
