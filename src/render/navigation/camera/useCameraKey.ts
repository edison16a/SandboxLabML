'use client';

import { useEffect } from 'react';

/**
 * Calls `onCycle` when C is pressed, the key that steps through the camera
 * views. Ignored while typing in a field or with a modifier held, so it
 * never fights a shortcut or a text box.
 */
export function useCameraKey(onCycle: () => void): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.isContentEditable || t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement) return;
      if (e.key === 'c' || e.key === 'C') onCycle();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCycle]);
}
