import { FRAMING_CAMERAS, type HsCamera } from './types';

const KEY = 'sandboxlab.hideseek.camera';

/**
 * The framing view this browser picked last, or null. Follow and first
 * person views are never restored: the lab opens on the grid, where they
 * have no agent to ride on. Storage can be missing or blocked, so every
 * access is guarded.
 */
export function loadCamera(): HsCamera | null {
  try {
    const saved = window.localStorage.getItem(KEY);
    return FRAMING_CAMERAS.includes(saved as HsCamera) ? (saved as HsCamera) : null;
  } catch {
    return null;
  }
}

/** Remembers a framing view for the next visit; a view that rides on an agent keeps the last one. Losing it only means the next visit opens on the default. */
export function saveCamera(camera: HsCamera): void {
  if (!FRAMING_CAMERAS.includes(camera)) return;
  try {
    window.localStorage.setItem(KEY, camera);
  } catch {
    // Nothing to do: the view still applies for this visit.
  }
}
