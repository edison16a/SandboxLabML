'use client';

import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';

export interface TourStep {
  /** CSS selector of the element to point at, usually a data-tour attribute. */
  target: string;
  title: string;
  body: string;
}

interface Props {
  steps: TourStep[];
  /** localStorage key that remembers the tour was seen. */
  storageKey: string;
  /** Bump to reopen the tour on demand (for the "Tour" button). */
  openSignal?: number;
}

function seen(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

function markSeen(key: string): void {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Private mode or blocked storage: the tour just shows again next time.
  }
}

/**
 * A short coach-mark tour: a ring around one control and a card that says
 * what it does. Shown once per browser, reopenable from a button. Arrow keys
 * and Enter move through it, Escape closes it.
 */
export function Tour({ steps, storageKey, openSignal = 0 }: Props) {
  const [index, setIndex] = useState<number | null>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    // Reopen right away on request; otherwise wait for the page to settle on a first visit.
    if (openSignal === 0 && seen(storageKey)) return;
    const t = setTimeout(() => setIndex(0), openSignal > 0 ? 0 : 1200);
    return () => clearTimeout(t);
  }, [openSignal, storageKey]);

  const close = useCallback(() => {
    markSeen(storageKey);
    setIndex(null);
  }, [storageKey]);

  const step = index !== null ? steps[index] : null;
  useLayoutEffect(() => {
    if (!step) return;
    const update = () => setRect(document.querySelector(step.target)?.getBoundingClientRect() ?? null);
    update();
    window.addEventListener('resize', update);
    const id = setInterval(update, 500);
    return () => {
      window.removeEventListener('resize', update);
      clearInterval(id);
    };
  }, [step]);

  useEffect(() => {
    if (index === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowRight' || e.key === 'Enter') {
        if (index + 1 < steps.length) setIndex(index + 1);
        else close();
      }
      else if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
      else return;
      e.stopPropagation();
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [index, steps.length, close]);

  if (!step || index === null) return null;
  const pad = 6;
  const cardTop = rect ? (rect.bottom + 180 < window.innerHeight ? rect.bottom + 12 : Math.max(12, rect.top - 172)) : window.innerHeight / 2 - 80;
  const cardLeft = rect ? Math.min(window.innerWidth - 332, Math.max(12, rect.left + rect.width / 2 - 160)) : window.innerWidth / 2 - 160;

  return (
    <div className="fixed inset-0 z-[70]" role="dialog" aria-label={`Tour: ${step.title}`}>
      <div className="absolute inset-0" onClick={close} />
      {rect && (
        <div
          className="pointer-events-none absolute rounded-lg ring-2 ring-accent transition-all duration-200"
          style={{ left: rect.left - pad, top: rect.top - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: '0 0 0 9999px rgba(5,7,12,0.55)' }}
        />
      )}
      <div className="absolute w-80 animate-pop-in rounded-lg border border-border-strong bg-surface-2 p-4 shadow-2xl shadow-black/50" style={{ top: cardTop, left: cardLeft }}>
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-[14px] font-semibold">{step.title}</h3>
          <button onClick={close} className="text-subtle hover:text-fg" aria-label="Close tour">
            <X className="size-4" />
          </button>
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{step.body}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-[11px] text-subtle">
            {index + 1} / {steps.length}
          </span>
          <div className="flex gap-2">
            {index > 0 && (
              <Button size="sm" variant="ghost" onClick={() => setIndex(index - 1)}>
                Back
              </Button>
            )}
            <Button size="sm" variant="primary" onClick={() => (index + 1 < steps.length ? setIndex(index + 1) : close())}>
              {index + 1 < steps.length ? 'Next' : 'Done'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
