'use client';

import { useLayoutEffect, type RefObject } from 'react';
import { useWalkthrough } from './walkStore';

/**
 * Moves focus into the card when the tour opens and whenever a step
 * changes while focus is elsewhere, as after the user pressed Train for
 * a step. Focus lands on the card itself, so screen readers read the step
 * and Enter carries on, and Tab reaches its buttons from there. When the
 * tour closes, focus goes back to where it was before.
 */
export function useWalkFocus(card: RefObject<HTMLElement | null>, key: string): void {
  // Notes where focus was before the effect below moves it, since layout effects run in order.
  useLayoutEffect(() => {
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const before = useWalkthrough.getState().returnTo ?? active;
    return () => {
      if (before?.isConnected && before !== document.body) before.focus({ preventScroll: true });
    };
  }, []);

  // Before the card paints: on a busy page a key pressed the moment it shows would otherwise land elsewhere.
  useLayoutEffect(() => {
    const el = card.current;
    if (!el || el.contains(document.activeElement)) return;
    el.querySelector<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true });
  }, [card, key]);
}
