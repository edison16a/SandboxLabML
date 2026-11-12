'use client';

import type * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { FRAME_PRIORITY } from '@/render/driving/frame/FrameDriver';
import { useDrivingScene } from '@/render/driving/frame/sceneContext';
import { applyLensShift, type PaneView } from '../stage/paneView';
import { heroChase, stepHeroChase } from './heroChase';

/**
 * The hero's camera on the city: a smooth low three quarter chase of the
 * SUV (see stepHeroChase), with the lens shifted so the SUV sits in the
 * middle of the part of the pane the page text leaves free. `target` is
 * kept on the SUV, so the sun's shadow box follows it.
 */
export function HeroChaseCamera({ pane, target }: { pane: PaneView; target: React.RefObject<THREE.Vector3> }) {
  const { frame } = useDrivingScene();
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const chase = useMemo(() => heroChase(), []);

  useFrame((_, rawDt) => {
    // The springs are stable at any step, so a slow frame still lands the camera where it belongs.
    stepHeroChase(chase, frame, camera, pane, Math.min(rawDt, 0.5));
    applyLensShift(camera, pane);
    target.current?.copy(frame.pos);
  }, FRAME_PRIORITY.camera);
  return null;
}
