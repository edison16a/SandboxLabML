'use client';

import { useLayoutEffect } from 'react';
import { isTyping } from '@/ui/typing';
import { finishTour, goBack, goNext } from './controls';
import type { Tour } from './types';

/**
 * A menu, popover or dialog of the page itself that is open. While one is,
 * its own keys win: Escape closes it and the arrows move inside it. A
 * tooltip is never "open" in this sense, and a popover that is closing
 * already says "closed", so neither holds the tour's keys back.
 */
function otherLayerOpen(): boolean {
  return !!document.querySelector('[data-radix-popper-content-wrapper] > [data-state="open"], [role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]');
}

/** Enter on a focused button or link should press it, not move the tour on. */
function onControl(target: EventTarget | null): boolean {
  return target instanceof Element && !!target.closest('button, a[href], [role="tab"], [role="radio"], [role="menuitem"], [role="switch"]');
}

/**
 * Right or Enter goes to the next step, Left goes back and Escape skips.
 * Listens before the lab does, so Escape skips the tour instead of
 * resetting the camera. Lab shortcuts like Space still work, since steps
 * ask for them.
 */
export function useWalkKeys(tour: Tour): void {
  // Attached as the card mounts, before it paints, so a key pressed the moment it shows is never lost.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || otherLayerOpen()) return;
      if (e.key === 'ArrowRight' || (e.key === 'Enter' && !onControl(e.target))) goNext(tour);
      else if (e.key === 'ArrowLeft') goBack(tour);
      else if (e.key === 'Escape') finishTour(tour);
      else return;
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [tour]);
}
