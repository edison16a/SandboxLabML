'use client';

import { useRef } from 'react';
import { openWalkthrough } from '@/ui/walkthrough/walkStore';

/**
 * Replays a lab's tour from a popover. The tour opens once the popover
 * has closed, in place of the popover handing focus back to its trigger.
 * Opening it any sooner, the popover could take focus back from the
 * tour's card a moment later. Give `button` to the trigger and
 * `onCloseAutoFocus` to the popover, then call `replay` with a close.
 */
export function useTourReplay(tour: string) {
  const button = useRef<HTMLButtonElement>(null);
  const replaying = useRef(false);
  const onCloseAutoFocus = (event: Event) => {
    if (!replaying.current) return;
    replaying.current = false;
    event.preventDefault();
    openWalkthrough(tour, button.current);
  };
  const replay = (close: () => void) => {
    replaying.current = true;
    close();
  };
  return { button, onCloseAutoFocus, replay };
}
