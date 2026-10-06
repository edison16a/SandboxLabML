import { useEffect, useRef, useState } from 'react';
import type { LessonPreview, PreviewResult } from '@/engine/lessons/preview/types';
import { analyze } from '../../../doc/analyze';
import { PreviewRunner } from './previewClient';

/** Quiet time after an edit before the preview simulates again, ms. Long enough to skip the middle of a word. */
const DEBOUNCE_MS = 500;
/** Recorded previews kept for the page's life, so stepping back or undoing an edit replays at once. */
const CACHE_SIZE = 8;
const cache = new Map<string, PreviewResult>();

function remember(source: string, result: PreviewResult): void {
  cache.delete(source);
  cache.set(source, result);
  if (cache.size > CACHE_SIZE) cache.delete(cache.keys().next().value as string);
}

export interface PreviewState {
  /** The latest recording that worked. It stays up while a newer one simulates or the text has errors. */
  preview: LessonPreview | null;
  /** Why the latest text could not be previewed, such as a brain from the other game. */
  message: string | null;
  busy: boolean;
  /** The text has errors, so the preview still shows the last version that compiled. */
  broken: boolean;
}

/**
 * Keeps a recorded preview of `source` up to date. The first one starts
 * at once; after that each edit waits for a short pause, and only text
 * that compiles is sent to the worker, so typing never queues up work.
 */
export function usePreview(source: string): PreviewState {
  const runner = useRef<PreviewRunner | null>(null);
  const latest = useRef(0);
  const started = useRef(false);
  const [shown, setShown] = useState<{ preview: LessonPreview | null; message: string | null }>({ preview: null, message: null });
  const [busy, setBusy] = useState(false);
  const broken = analyze(source).counts.error > 0;

  useEffect(() => {
    const r = new PreviewRunner();
    runner.current = r;
    return () => r.stop();
  }, []);

  useEffect(() => {
    const id = ++latest.current;
    const show = (r: PreviewResult) => setShown(r.ok ? { preview: r.preview, message: null } : { preview: null, message: r.message });
    if (broken) {
      setBusy(false);
      return;
    }
    const hit = cache.get(source);
    if (hit) {
      setBusy(false);
      show(hit);
      return;
    }
    const timer = setTimeout(
      () => {
        started.current = true;
        setBusy(true);
        runner.current
          ?.run(source)
          .then(
            (r) => {
              remember(source, r);
              if (latest.current === id) show(r);
            },
            (err: unknown) => {
              if (latest.current !== id || (err instanceof DOMException && err.name === 'AbortError')) return;
              setShown({ preview: null, message: err instanceof Error ? err.message : String(err) });
            },
          )
          .finally(() => {
            if (latest.current === id) setBusy(false);
          });
      },
      started.current ? DEBOUNCE_MS : 0,
    );
    return () => clearTimeout(timer);
  }, [source, broken]);

  return { ...shown, busy, broken };
}
