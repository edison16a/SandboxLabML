'use client';

import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';
import { XRAY_LAYER } from '../grid/scratch';
import { firstPersonAgent } from './cameraViews';

/**
 * Hides the see through silhouettes while the camera looks through an
 * agent's eyes. Those silhouettes show players behind walls, which the
 * agent itself cannot see, so a first person view would give away more
 * than the brain ever gets.
 */
export function FirstPersonLayers() {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const firstPerson = useHideSeekLab((s) => firstPersonAgent(s.camera) >= 0);
  useEffect(() => {
    if (firstPerson) camera.layers.disable(XRAY_LAYER);
    else camera.layers.enable(XRAY_LAYER);
    invalidate();
  }, [camera, firstPerson, invalidate]);
  return null;
}
