'use client';

import { useEffect } from 'react';
import type { SpeedMode } from '@/workers/shared/protocol';
import { racingSession } from '../session/RacingSession';
import { useRacingLab, type CameraMode, type ViewMode } from '../state/labStore';

const SPEEDS: SpeedMode[] = ['1x', '2x', '4x', 'turbo', 'max'];
const CAMERAS: CameraMode[] = ['chase', 'orbit', 'top', 'free'];
const VIEWS: ViewMode[] = ['population', 'overlay', 'both'];

function next<T>(list: T[], current: T): T {
  return list[(list.indexOf(current) + 1) % list.length];
}

/**
 * Keyboard shortcuts for the lab: Space trains or pauses, S steps one
 * generation, 1 to 5 pick a speed, I toggles the inputs overlay, C cycles
 * cameras, V cycles views, N opens a new run. Ignored while typing.
 */
export function useLabShortcuts(onNewRun: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = useRacingLab.getState();
      const session = racingSession();
      const key = e.key.toLowerCase();
      if (key === ' ') {
        e.preventDefault();
        void (s.status === 'running' ? session.pause() : session.start());
      } else if (key === 's' && s.status !== 'running') void session.start(1);
      else if (key >= '1' && key <= '5') void session.setSpeed(SPEEDS[Number(key) - 1]);
      else if (key === 'i') s.set({ inputsOverlay: !s.inputsOverlay });
      else if (key === 'c') s.set({ camera: next(CAMERAS, s.camera) });
      else if (key === 'v') s.set({ view: next(VIEWS, s.view) });
      else if (key === 'n') onNewRun();
      else if (key === 'escape') s.set({ focus: { kind: 'champion' } });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onNewRun]);
}
