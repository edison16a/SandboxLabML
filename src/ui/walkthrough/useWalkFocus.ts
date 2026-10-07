'use client';

import { useEffect, type RefObject } from 'react';

/**
 * Moves focus into the card when the tour opens and whenever a step
 * changes while focus is elsewhere, as after the user pressed Train for
 * a step. Focus lands on the card itself, so screen readers read the step
 * and Enter carries on, and Tab reaches its buttons from there. When the
 * tour closes, focus goes back to where it was before.
 */
export function useWalkFocus(card: RefObject<HTMLElement | null>, key: string): void {
  useEffect(() => {
    const before = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    return () => {
      if (before?.isConnected && before !== document.body) before.focus({ preventScroll: true });
    };
  }, []);

  useEffect(() => {
    // A frame later, so a menu that just closed has handed focus back first and does not take it again.
    const raf = requestAnimationFrame(() => {
      const el = card.current;
      if (!el || el.contains(document.activeElement)) return;
      el.querySelector<HTMLElement>('[role="dialog"]')?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(raf);
  }, [card, key]);
}
