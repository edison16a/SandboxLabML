import { lex } from '@/engine/script';

/** Which kind of code the cursor is in, which decides what autocomplete offers. */
export type CursorScope = 'top' | 'tick' | 'generation';

/**
 * Finds the block around an offset from tokens alone. The lexer copes with
 * half-typed text where the parser would bail out, which is exactly the
 * state the text is in while someone is typing.
 */
export function scopeAt(source: string, offset: number): CursorScope {
  const { tokens } = lex(source.slice(0, offset));
  const stack: CursorScope[] = [];
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t.kind !== 'punct') continue;
    if (t.text === '{') {
      const name = tokens[i - 1];
      const each = tokens[i - 2];
      const event = each?.kind === 'keyword' && each.text === 'each' && (name?.text === 'tick' || name?.text === 'generation') ? (name.text as CursorScope) : 'top';
      stack.push(event);
    } else if (t.text === '}') {
      stack.pop();
    }
  }
  return stack.find((s) => s !== 'top') ?? 'top';
}

/**
 * Unclosed `{` before an offset, skipping strings and comments. The editor
 * indents a new line by this many levels.
 */
export function braceDepth(text: string): number {
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      i++;
      while (i < text.length && text[i] !== '"' && text[i] !== '\n') i += text[i] === '\\' ? 2 : 1;
    } else if (ch === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
    } else if (ch === '{') depth++;
    else if (ch === '}') depth = Math.max(0, depth - 1);
  }
  return depth;
}

/** A number and maybe a partial unit right before the cursor, such as `5 s` or `45 de`. */
export function unitContext(lineBefore: string): { unitFrom: number } | null {
  const m = /(?:^|[^\w.])(\d+(?:\.\d+)?)( ?)([a-z/%]*)$/i.exec(lineBefore);
  if (!m) return null;
  if (m[2] === '' && m[3] === '') return null;
  return { unitFrom: lineBefore.length - m[3].length };
}
