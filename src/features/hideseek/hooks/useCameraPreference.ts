'use client';

import { useEffect } from 'react';
import { loadCamera, saveCamera } from '../state/cameraPreference';
import { useHideSeekLab } from '../state/hideSeekStore';

/**
 * True once the saved view has been put back. The store outlives the lab,
 * so a remount (coming back to the lab) keeps the view on screen instead
 * of snapping back to the saved one.
 */
let restored = false;

/**
 * Restores the camera view this browser picked last and saves every
 * change, so the lab opens on the view each person likes. The lab calls it
 * once, high up, so it keeps saving while parts of the HUD come and go
 * (photo mode hides them). It runs after mount, so the server render and
 * the first client render agree.
 */
export function useCameraPreference(): void {
  useEffect(() => {
    if (!restored) {
      restored = true;
      const saved = loadCamera();
      const lab = useHideSeekLab.getState();
      if (saved && saved !== lab.camera) lab.set({ camera: saved });
    }
    return useHideSeekLab.subscribe((s, prev) => {
      if (s.camera !== prev.camera) saveCamera(s.camera);
    });
  }, []);
}
