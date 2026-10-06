/**
 * One undo stack over whole document states, shared by the code and blocks
 * views. Storing full texts instead of change sets keeps it simple and
 * view agnostic: a block edit and a keystroke are both just a new text.
 * Scripts are a few kilobytes, so 200 states cost almost nothing.
 */
export interface DocHistory {
  /** Older states, oldest first. */
  past: string[];
  present: string;
  /** States undone, the next one to redo last. */
  future: string[];
  /** Group of the last commit, so a burst of typing undoes in one step. */
  group: { key: string; at: number } | null;
}

export const HISTORY_DEPTH = 200;

/** Typing in the same group within this window merges into one undo step. */
export const GROUP_WINDOW_MS = 1200;

export interface CommitOptions {
  /** Commits with the same key close together in time merge, such as "typing". Leave it out for a step of its own. */
  group?: string;
  /** Clock for the group window. Tests pass it in, the app uses Date.now(). */
  at?: number;
}

export function createHistory(text: string): DocHistory {
  return { past: [], present: text, future: [], group: null };
}

/** Records a new text. Committing the text already present changes nothing. */
export function commit(h: DocHistory, text: string, opts: CommitOptions = {}): DocHistory {
  if (text === h.present) return h;
  const at = opts.at ?? Date.now();
  const merge = opts.group !== undefined && h.group?.key === opts.group && at - h.group.at <= GROUP_WINDOW_MS && h.past.length > 0;
  const group = opts.group === undefined ? null : { key: opts.group, at };
  if (merge) return { past: h.past, present: text, future: [], group };
  const past = [...h.past, h.present];
  if (past.length > HISTORY_DEPTH) past.splice(0, past.length - HISTORY_DEPTH);
  return { past, present: text, future: [], group };
}

export function canUndo(h: DocHistory): boolean {
  return h.past.length > 0;
}

export function canRedo(h: DocHistory): boolean {
  return h.future.length > 0;
}

export function undo(h: DocHistory): DocHistory {
  if (h.past.length === 0) return h;
  const past = h.past.slice(0, -1);
  return { past, present: h.past[h.past.length - 1], future: [...h.future, h.present], group: null };
}

export function redo(h: DocHistory): DocHistory {
  if (h.future.length === 0) return h;
  const future = h.future.slice(0, -1);
  return { past: [...h.past, h.present], present: h.future[h.future.length - 1], future, group: null };
}

/** Ends the current typing group, so the next keystroke starts a new undo step. */
export function seal(h: DocHistory): DocHistory {
  return h.group ? { ...h, group: null } : h;
}
