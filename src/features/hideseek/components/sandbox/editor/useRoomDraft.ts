'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SandboxRoom } from '@/engine/hideseek/sandbox/room';
import type { EditResult } from '@/engine/hideseek/sandbox/roomEdit';

/** Undo steps kept. Rooms are small, so this costs next to nothing. */
const UNDO_LIMIT = 100;
/** How long a refused edit's reason stays in the hint line, ms. */
const NOTICE_MS = 2600;

/**
 * The room being edited, with undo. Every edit replaces the whole room (the
 * rules in roomEdit return new rooms), so undo is a stack of earlier rooms.
 * A refused edit leaves the room alone and shows its reason for a moment.
 */
export function useRoomDraft(initial: SandboxRoom) {
  const [state, setState] = useState({ room: initial, past: [] as SandboxRoom[] });
  const [notice, setNotice] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const flash = useCallback((message: string) => {
    setNotice(message);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setNotice(null), NOTICE_MS);
  }, []);

  const apply = useCallback((room: SandboxRoom) => {
    setState((s) => (room === s.room ? s : { room, past: [...s.past.slice(1 - UNDO_LIMIT), s.room] }));
    setNotice(null);
  }, []);

  /** Applies an edit, or shows why it was refused. */
  const edit = useCallback((result: EditResult) => (result.room ? apply(result.room) : flash(result.error)), [apply, flash]);

  const undo = useCallback(() => setState((s) => (s.past.length ? { room: s.past[s.past.length - 1], past: s.past.slice(0, -1) } : s)), []);

  /** Renaming is not an undo step: it would make undo walk back one letter at a time. */
  const rename = useCallback((name: string) => setState((s) => ({ ...s, room: { ...s.room, name } })), []);

  return { room: state.room, canUndo: state.past.length > 0, apply, edit, undo, rename, flash, notice };
}

export type RoomDraft = ReturnType<typeof useRoomDraft>;
