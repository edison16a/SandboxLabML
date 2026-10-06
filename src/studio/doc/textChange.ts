/** A single replacement that turns one text into another. */
export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

/**
 * The smallest single replacement between two texts, found by trimming the
 * common prefix and suffix. The code editor applies undo, redo and block
 * edits this way instead of swapping the whole document, so the cursor and
 * scroll position stay where they were.
 */
export function minimalChange(before: string, after: string): TextChange | null {
  if (before === after) return null;
  const max = Math.min(before.length, after.length);
  let start = 0;
  while (start < max && before.charCodeAt(start) === after.charCodeAt(start)) start++;
  let end = 0;
  while (end < max - start && before.charCodeAt(before.length - 1 - end) === after.charCodeAt(after.length - 1 - end)) end++;
  return { from: start, to: before.length - end, insert: after.slice(start, after.length - end) };
}

/** Line and column (both 1-based) of an offset, for the status line. */
export function lineCol(text: string, offset: number): { line: number; col: number } {
  const end = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  let lineStart = 0;
  for (let i = 0; i < end; i++) {
    if (text.charCodeAt(i) === 10) {
      line++;
      lineStart = i + 1;
    }
  }
  return { line, col: end - lineStart + 1 };
}
