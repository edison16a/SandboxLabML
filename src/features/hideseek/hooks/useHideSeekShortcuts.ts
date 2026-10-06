'use client';

import { useEffect } from 'react';
import type { SpeedMode } from '@/workers/shared/protocol';
import { hideSeekSession } from '../session/HideSeekSession';
import { gridCapped, useHideSeekLab } from '../state/hideSeekStore';
import { GRID_SIZES, HS_CAMERAS, type GridSize } from '../state/types';

const SPEEDS: SpeedMode[] = ['1x', '2x', '4x', 'turbo', 'max'];

function next<T>(list: readonly T[], current: T): T {
  return list[(list.indexOf(current) + 1) % list.length];
}

/** Grid sizes this machine may show. A capped grid stops at 25 arenas. */
export function allowedGridSizes(capped: boolean): GridSize[] {
  return capped ? GRID_SIZES.filter((g) => g <= 25) : GRID_SIZES;
}

/**
 * Keyboard shortcuts for the lab: Space trains or pauses, S steps one
 * generation, 1 to 5 pick a speed, I toggles the inputs overlay, C cycles
 * cameras, G cycles the grid size, N opens a new run and Escape steps back
 * out of photo mode, then out of the focused arena. Ignored while typing.
 */
export function useHideSeekShortcuts(onNewRun: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = useHideSeekLab.getState();
      const session = hideSeekSession();
      const key = e.key.toLowerCase();
      if (key === ' ') {
        e.preventDefault();
        void (s.status === 'running' ? session.pause() : session.start());
      } else if (key === 's' && s.status !== 'running') void session.start(1);
      else if (key >= '1' && key <= '5') void session.setSpeed(SPEEDS[Number(key) - 1]);
      else if (key === 'i') s.set({ inputsOverlay: !s.inputsOverlay });
      else if (key === 'c') s.set({ camera: next(HS_CAMERAS, s.camera) });
      else if (key === 'g' && s.mode === 'train') s.set({ gridSize: next(allowedGridSizes(gridCapped(s)), s.gridSize), focus: null });
      else if (key === 'n') onNewRun();
      else if (key === 'escape') {
        if (s.photoMode) s.set({ photoMode: false });
        else if (s.mode === 'train' && s.focus !== null && s.gridSize > 1) s.set({ focus: null });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNewRun]);
}
