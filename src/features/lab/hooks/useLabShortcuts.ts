'use client';

import { useEffect } from 'react';
import { inDialog, isTyping } from '@/ui/typing';
import type { SpeedMode } from '@/workers/shared/protocol';
import { useLabContext } from '../LabContext';
import type { ViewMode } from '../state/labState';

const SPEEDS: SpeedMode[] = ['1x', '2x', '4x', 'turbo', 'max'];
const VIEWS: ViewMode[] = ['population', 'overlay', 'both'];

function next<T>(list: readonly T[], current: T): T {
  return list[(list.indexOf(current) + 1) % list.length];
}

export interface ShortcutOptions {
  /** The lab's cameras in the order C cycles them. */
  cameras: readonly string[];
  /** Keys the lab handles itself first, such as Space in its Sandbox. Returns true when it handled one. */
  onKey?: (key: string) => boolean;
}

/**
 * Keyboard shortcuts every lab shares: Space trains or pauses, S steps one
 * generation, 1 to 5 pick a speed, I toggles the inputs overlay, C cycles
 * cameras, V cycles views, N opens a new run and Esc follows the leader
 * again. Ignored while typing, inside a dialog (whose buttons own their
 * keys, as in the course editor) or with a modifier held.
 */
export function useLabShortcuts(onNewRun: () => void, { cameras, onKey }: ShortcutOptions) {
  const { api, session } = useLabContext();
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (isTyping(e.target) || inDialog(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const s = api.getState();
      const key = e.key.toLowerCase();
      if (key === ' ') e.preventDefault();
      if (onKey?.(key)) return;
      if (key === ' ') void (s.status === 'running' ? session.pause() : session.start());
      else if (key === 's' && s.status !== 'running' && s.mode === 'train') void session.start(1);
      else if (key >= '1' && key <= '5') void session.setSpeed(SPEEDS[Number(key) - 1]);
      else if (key === 'i') api.setState({ inputsOverlay: !s.inputsOverlay });
      else if (key === 'c') api.setState({ camera: next(cameras, s.camera) });
      else if (key === 'v') api.setState({ view: next(VIEWS, s.view) });
      else if (key === 'n') onNewRun();
      else if (key === 'escape') api.setState({ focus: { kind: 'champion' } });
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [api, session, onNewRun, cameras, onKey]);
}
