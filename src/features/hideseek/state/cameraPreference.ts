import { HS_CAMERAS, type HsCamera } from './types';

const KEY = 'sandboxlab.hideseek.camera';

/** The view this browser picked last, or null. Storage can be missing or blocked, so every access is guarded. */
export function loadCamera(): HsCamera | null {
  try {
    const saved = window.localStorage.getItem(KEY);
    return HS_CAMERAS.includes(saved as HsCamera) ? (saved as HsCamera) : null;
  } catch {
    return null;
  }
}

/** Remembers the view for the next visit. Losing it only means the next visit opens on the default. */
export function saveCamera(camera: HsCamera): void {
  try {
    window.localStorage.setItem(KEY, camera);
  } catch {
    // Nothing to do: the view still applies for this visit.
  }
}
