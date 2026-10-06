'use client';

import { useCallback, useLayoutEffect, useState, useSyncExternalStore, type RefObject } from 'react';

export interface SplitSizeOptions {
  /** Remembers the size per page under sandboxlab.split.<id>. */
  id: string;
  /** Custom property the page reads for the pane width, such as --panel-w. It is set on the handle's parent. */
  cssVar: string;
  defaultSize: number;
  min: number;
  max: number;
}

const storageKey = (id: string) => `sandboxlab.split.${id}`;
const listeners = new Set<() => void>();

/** Storage can be blocked (private windows, embedded previews), so a missing value is the normal case. */
function readSaved(id: string): number | null {
  try {
    const n = Number(window.localStorage.getItem(storageKey(id)));
    return Number.isFinite(n) && n > 0 ? n : null;
  } catch {
    return null;
  }
}

function writeSaved(id: string, size: number | null) {
  try {
    if (size === null) window.localStorage.removeItem(storageKey(id));
    else window.localStorage.setItem(storageKey(id), String(size));
  } catch {
    // The width still applies for this visit through the drag state below.
  }
  listeners.forEach((l) => l());
}

/** Hears saves from this tab and from other tabs, so two open labs agree on the width. */
function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener('storage', listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', listener);
  };
}

/**
 * Width of one resizable pane. The value lives here, not in the page, so a
 * drag only re-renders the handle: the page reads the width through a CSS
 * variable on the shared parent and never re-renders while it changes.
 */
export function useSplitSize(handle: RefObject<HTMLElement | null>, { id, cssVar, defaultSize, min, max }: SplitSizeOptions) {
  const saved = useSyncExternalStore(
    subscribe,
    () => readSaved(id),
    () => null,
  );
  // Set while a drag is in progress, and kept when storage refuses the write.
  const [held, setHeld] = useState<number | null>(null);
  const clamp = useCallback((n: number) => Math.round(Math.min(max, Math.max(min, n))), [min, max]);
  const size = clamp(held ?? saved ?? defaultSize);

  // A layout effect runs before the first paint, so a saved width never shows the default first.
  useLayoutEffect(() => {
    handle.current?.parentElement?.style.setProperty(cssVar, `${size}px`);
  }, [handle, cssVar, size]);

  /** Moves the pane while dragging, without saving yet. */
  const preview = useCallback((n: number) => setHeld(clamp(n)), [clamp]);
  /** Settles on a width and remembers it. */
  const commit = useCallback(
    (n: number) => {
      const next = clamp(n);
      writeSaved(id, next);
      setHeld(readSaved(id) === next ? null : next);
    },
    [clamp, id],
  );
  const reset = useCallback(() => {
    writeSaved(id, null);
    setHeld(null);
  }, [id]);
  return { size, preview, commit, reset };
}
