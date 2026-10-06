import { parse } from '@/engine/script';
import type { DocHistory } from './history';

/** How far back to look. Older states are rarely what someone wants to see, and parsing each one costs a little. */
const LOOKBACK = 60;

function parsesCleanly(text: string): boolean {
  return !parse(text).diagnostics.some((d) => d.severity === 'error');
}

/**
 * The newest text in the undo history that parses without a syntax error.
 * The blocks view shows it, dimmed, while the present text is broken. The
 * history already holds every earlier state, so nothing extra is stored,
 * and switching to blocks after typing a mistake still has a tree to show.
 */
export function lastValidText(h: DocHistory): string | null {
  if (parsesCleanly(h.present)) return h.present;
  const stop = Math.max(0, h.past.length - LOOKBACK);
  for (let i = h.past.length - 1; i >= stop; i--) if (parsesCleanly(h.past[i])) return h.past[i];
  return null;
}
