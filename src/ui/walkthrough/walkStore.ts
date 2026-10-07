import { create } from 'zustand';

interface WalkState {
  /** Id of the tour on screen, or null. */
  open: string | null;
  /** 0 is the welcome card, 1 and up are the steps. */
  index: number;
  /** True once the user did what the current step asked. */
  acted: boolean;
  /** True during the short fade after the tour closes. */
  leaving: boolean;
}

/**
 * Which tour is open and where it stands. A store rather than component
 * state, so the help menu in each lab can replay a tour it does not own.
 */
export const useWalkthrough = create<WalkState>(() => ({ open: null, index: 0, acted: false, leaving: false }));

/** Matches the fade on the overlay in Stage. */
const FADE_MS = 200;
let fadeTimer: ReturnType<typeof setTimeout> | undefined;

/** Opens a tour on its welcome card. Help menus call this to replay one. */
export function openWalkthrough(id: string): void {
  clearTimeout(fadeTimer);
  useWalkthrough.setState({ open: id, index: 0, acted: false, leaving: false });
}

export function showStep(index: number, acted: boolean): void {
  useWalkthrough.setState({ index, acted });
}

export function markActed(): void {
  useWalkthrough.setState({ acted: true });
}

/** Fades the tour out, or removes it at once when its lab is going away. */
export function closeWalkthrough(immediate = false): void {
  clearTimeout(fadeTimer);
  const reset = { open: null, index: 0, acted: false, leaving: false };
  if (immediate) {
    useWalkthrough.setState(reset);
    return;
  }
  useWalkthrough.setState({ leaving: true });
  fadeTimer = setTimeout(() => useWalkthrough.setState(reset), FADE_MS);
}
