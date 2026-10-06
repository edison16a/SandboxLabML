'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import type { ArenaFeed } from '@/workers/client/arenaFeed';
import { HS_TONE_MAPPING } from '../palette';

/**
 * Renders the main scene when nothing else does. R3F stops its own render
 * as soon as any frame callback has a positive priority, which the picture
 * in picture pass does; with the effect composer off, this takes its place.
 */
export function MainPass() {
  useFrame(({ gl, scene, camera }) => gl.render(scene, camera), 1);
  return null;
}

/**
 * The renderer tone maps unless the effect composer does it, in which
 * case the renderer must hand over linear colors untouched.
 */
export function ToneMappingSync({ composer }: { composer: boolean }) {
  const gl = useThree((s) => s.gl);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    gl.toneMapping = composer ? THREE.NoToneMapping : HS_TONE_MAPPING;
    gl.toneMappingExposure = 1;
    invalidate();
  }, [gl, composer, invalidate]);
  return null;
}

/**
 * While training is paused the canvas only draws on demand. This asks for a
 * frame whenever the lab's state changes or a worker sends a frame, so the
 * view still reacts to every click and late snapshot.
 */
export function InvalidateOnChange({ feeds }: { feeds: () => ArenaFeed[] }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const unsubs = [useHideSeekLab.subscribe(() => invalidate()), ...feeds().map((f) => f.on(() => invalidate()))];
    return () => unsubs.forEach((u) => u());
  }, [feeds, invalidate]);
  return null;
}

/** Pixel ratio range per tier: resolution is the first thing a cheaper tier gives up. */
export function tierDpr(tier: HsQualityTier): [number, number] {
  if (tier === 'low') return [1, 1];
  if (tier === 'medium') return [1, 1.5];
  if (tier === 'high') return [1, 2];
  return [1, 3];
}
