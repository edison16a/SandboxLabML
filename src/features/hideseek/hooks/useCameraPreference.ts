'use client';

import { useEffect } from 'react';
import { loadCamera, saveCamera } from '../state/cameraPreference';
import { useHideSeekLab } from '../state/hideSeekStore';

/**
 * Restores the camera view this browser picked last and saves every
 * change, so the lab opens on the view each person likes. It runs after
 * mount, so the server render and the first client render agree.
 */
export function useCameraPreference(): void {
  useEffect(() => {
    const saved = loadCamera();
    const lab = useHideSeekLab.getState();
    if (saved && saved !== lab.camera) lab.set({ camera: saved });
    return useHideSeekLab.subscribe((s, prev) => {
      if (s.camera !== prev.camera) saveCamera(s.camera);
    });
  }, []);
}
