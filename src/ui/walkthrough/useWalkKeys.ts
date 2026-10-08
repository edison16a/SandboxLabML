'use client';

import { useLayoutEffect } from 'react';
import { isTyping } from '@/ui/typing';
import { finishTour, goBack, goNext } from './controls';
import { keySpot, walkMove } from './keys';
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

/**
 * Right or Enter goes to the next step, Left goes back and Escape skips,
 * except where walkMove leaves a key to the page. Listens before the lab
 * does, so a key the tour uses never also reaches the lab. Lab shortcuts
 * like Space still work, since steps ask for them.
 */
export function useWalkKeys(tour: Tour): void {
  // Attached as the card mounts, before it paints, so a key pressed the moment it shows is never lost.
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target) || otherLayerOpen()) return;
      const move = walkMove(e.key, keySpot(e.target, tour.pageOwnsEscape?.() ?? false));
      if (!move) return;
      if (move === 'next') goNext(tour);
      else if (move === 'back') goBack(tour);
      else finishTour(tour);
      e.preventDefault();
      e.stopPropagation();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [tour]);
}
