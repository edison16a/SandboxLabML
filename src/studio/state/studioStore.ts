import { create } from 'zustand';
import type { EnvId } from '@/engine/env/types';
import type { ScriptEntry } from '@/storage/scripts';
import { commit, createHistory, redo, seal, undo, type DocHistory } from '../doc/history';

export type EditorMode = 'code' | 'blocks';
export type PanelTab = 'reference' | 'problems' | 'test' | 'learn' | 'bench';
export type EnvFilter = 'all' | EnvId;

/** A request for the code view to select a range and scroll to it. The nonce makes repeated clicks on one problem work. */
export interface Reveal {
  from: number;
  to: number;
  nonce: number;
}

/**
 * Studio UI state. The open script's text lives in `history.present`, and
 * both editors read and write it through `edit`, so they can never drift
 * apart. Storage calls live in scriptActions, not here.
 */
export interface StudioState {
  script: ScriptEntry | null;
  history: DocHistory;
  /** Text as last saved. The script is dirty when the present text differs. */
  saved: string;
  saving: boolean;
  mode: EditorMode;
  panel: PanelTab;
  envFilter: EnvFilter;
  /** Cursor offset in the code view, used to insert examples where the author is. */
  cursor: number;
  reveal: Reveal | null;
  /** 1-based lines a lesson step points at. */
  highlightLines: number[];
  explain: boolean;
  /** Bumped after a storage change so the sidebar reloads its lists. */
  listVersion: number;
  /** Lesson to open in the Learn tab, from ?lesson= or a link. */
  lessonId: string | null;

  set: (patch: Partial<StudioState>) => void;
  open: (entry: ScriptEntry) => void;
  edit: (text: string, group?: string) => void;
  undo: () => void;
  redo: () => void;
  revealSpan: (from: number, to: number) => void;
}

let nonce = 0;

export const useStudio = create<StudioState>((set, get) => ({
  script: null,
  history: createHistory(''),
  saved: '',
  saving: false,
  mode: 'code',
  panel: 'reference',
  envFilter: 'all',
  cursor: 0,
  reveal: null,
  highlightLines: [],
  explain: false,
  listVersion: 0,
  lessonId: null,

  set: (patch) => set(patch),
  open: (entry) => set({ script: entry, history: createHistory(entry.source), saved: entry.source, cursor: 0, reveal: null }),
  edit: (text, group) => {
    if (get().script?.readonly) return;
    set({ history: commit(get().history, text, { group }) });
  },
  undo: () => set({ history: undo(seal(get().history)) }),
  redo: () => set({ history: redo(get().history) }),
  revealSpan: (from, to) => set({ mode: 'code', reveal: { from, to, nonce: ++nonce } }),
}));

export const selectText = (s: StudioState) => s.history.present;

export function isDirty(s: StudioState): boolean {
  return s.script !== null && !s.script.readonly && s.history.present !== s.saved;
}
