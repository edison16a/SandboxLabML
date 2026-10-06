'use client';

import { useEffect } from 'react';
import { saveCurrent } from '../state/scriptActions';
import { isDirty, useStudio } from '../state/studioStore';

function typingIn(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  return el.isContentEditable || el.closest('.cm-editor') !== null || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName);
}

/**
 * Studio wide keys: Ctrl or Cmd with S saves from anywhere, and undo and
 * redo work in the blocks view too. Inside the code editor CodeMirror's own
 * keymap handles them, and text fields keep their native undo. Also warns
 * before the tab closes with unsaved work.
 */
export function useStudioShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === 's') {
        e.preventDefault();
        void saveCurrent();
        return;
      }
      if (typingIn(e.target)) return;
      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        useStudio.getState().undo();
      } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
        e.preventDefault();
        useStudio.getState().redo();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (isDirty(useStudio.getState())) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('beforeunload', onUnload);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('beforeunload', onUnload);
    };
  }, []);
}
