'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/ui/cn';
import { readMarker } from './doneMarker';
import { announcement, shouldAutoStart, stepAt, textOf } from './flow';
import { Spotlight } from './Spotlight';
import { StepCard } from './StepCard';
import { revealTarget } from './reveal';
import type { StepText, Tour, WalkStep } from './types';
import { useReducedMotion } from './useReducedMotion';
import { useStage } from './useStage';
import { useWalkFocus } from './useWalkFocus';
import { useWalkKeys } from './useWalkKeys';
import { closeWalkthrough, markActed, openWalkthrough, useWalkthrough } from './walkStore';

/** How long a first visit waits before the tour opens, so the lab shows itself first. */
const FIRST_RUN_DELAY_MS = 900;

/** Checks a few times a second whether the user did what the step asks. */
function useActionWatch(step: WalkStep | null, acted: boolean): void {
  useEffect(() => {
    const done = step?.action?.done;
    if (!done || acted) return;
    const id = setInterval(() => {
      if (done()) markActed();
    }, 150);
    return () => clearInterval(id);
  }, [step, acted]);
}

/** Scrolls a step's target into view when the step opens, as on a phone where toolbars scroll sideways. */
function useReveal(text: StepText | null, key: string, reduced: boolean): void {
  const target = text?.target;
  const fallback = text?.fallback;
  useEffect(() => {
    if (!target) return;
    const selector = document.querySelector(target) || !fallback ? target : fallback;
    revealTarget(selector, !reduced);
  }, [target, fallback, key, reduced]);
}

/** Marks the page while the tour is open, so CSS can keep tooltips from popping up under the dim layer. */
function usePageFlag(): void {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-walkthrough', '');
    return () => root.removeAttribute('data-walkthrough');
  }, []);
}

function Stage({ tour }: { tour: Tour }) {
  const index = useWalkthrough((s) => s.index);
  const acted = useWalkthrough((s) => s.acted);
  const leaving = useWalkthrough((s) => s.leaving);
  const reduced = useReducedMotion();
  const step = stepAt(tour, index);
  const key = `${index}:${acted}`;
  const root = useRef<HTMLDivElement>(null);
  const dim = useRef<SVGPathElement>(null);
  const ring = useRef<SVGRectElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const text = step ? textOf(step, acted) : null;
  useStage({ root, dim, ring, card }, { text, reduced, key });
  useReveal(text, key, reduced);
  useWalkKeys(tour);
  useWalkFocus(card, key);
  useActionWatch(step, acted);
  usePageFlag();

  // A press on the dimmed page gives the card a small nudge, to show where the tour is waiting.
  const nudge = () => {
    if (!reduced) panel.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.025)' }, { transform: 'scale(1)' }], { duration: 280, easing: 'ease-out' });
  };

  return (
    <div ref={root} className={cn('pointer-events-none fixed inset-0 z-[80] transition-opacity duration-200', leaving && 'opacity-0')}>
      <Spotlight dimRef={dim} ringRef={ring} onDimPress={nudge} />
      <StepCard tour={tour} index={index} acted={acted} cardRef={card} panelRef={panel} />
      <p aria-live="polite" className="sr-only">
        {announcement(tour, index, acted)}
      </p>
    </div>
  );
}

/**
 * The guided tour of a lab. It opens by itself the first time someone
 * opens the lab, once `ready` says the lab is up, and stays closed once it
 * was finished or skipped. The lab's help menu can replay it any time.
 */
export function Walkthrough({ tour, ready }: { tour: Tour; ready: boolean }) {
  const open = useWalkthrough((s) => s.open === tour.id);

  useEffect(() => {
    if (!ready || !shouldAutoStart(readMarker(tour.storageKey))) return;
    const t = setTimeout(() => {
      if (!useWalkthrough.getState().open) openWalkthrough(tour.id);
    }, FIRST_RUN_DELAY_MS);
    return () => clearTimeout(t);
  }, [ready, tour]);

  // Leaving the lab mid tour closes it. It was not finished, so it offers itself again next visit.
  useEffect(
    () => () => {
      if (useWalkthrough.getState().open === tour.id) closeWalkthrough(true);
    },
    [tour.id],
  );

  return open ? createPortal(<Stage tour={tour} />, document.body) : null;
}
