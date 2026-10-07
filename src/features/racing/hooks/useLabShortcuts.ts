'use client';

import { useEffect } from 'react';
import { isTyping } from '@/ui/typing';
import type { SpeedMode } from '@/workers/shared/protocol';
import { racingSession } from '../session/RacingSession';
import { useRacingLab, type CameraMode, type ViewMode } from '../state/labStore';

const SPEEDS: SpeedMode[] = ['1x', '2x', '4x', 'turbo', 'max'];
const CAMERAS: CameraMode[] = ['chase', 'orbit', 'trackside', 'top', 'free'];
const VIEWS: ViewMode[] = ['population', 'overlay', 'both'];

function next<T>(list: T[], current: T): T {
  return list[(list.indexOf(current) + 1) % list.length];
}

/**
 * Keyboard shortcuts for the lab: Space trains or pauses, S steps one
 * generation, 1 to 5 pick a speed, I toggles the inputs overlay, C cycles
 * cameras, V cycles views, N opens a new run. In the Sandbox, Space plays
 * or pauses the race and R restarts it. Ignored while typing.
 */
export function useLabShortcuts(onNewRun: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTyping(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = useRacingLab.getState();
      const session = racingSession();
      const key = e.key.toLowerCase();
      if (key === ' ') {
        e.preventDefault();
        // In the Sandbox, Space plays and pauses the race. Training stays paused until the user goes back.
        if (s.mode === 'sandbox') void session.sandbox?.setPaused(!s.sandboxPaused);
        else void (s.status === 'running' ? session.pause() : session.start());
      } else if (key === 'r' && s.mode === 'sandbox') void session.sandbox?.restart();
      else if (key === 's' && s.status !== 'running' && s.mode === 'train') void session.start(1);
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
