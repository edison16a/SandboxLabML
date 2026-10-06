import type { Comment, Trivia } from '../ast';
import { insertFix, replaceFix, type Span } from '../diagnostics';
import { bestSuggestion } from '../autocorrect/suggest';
import type { Token } from '../lexer';
import { ParseFail, type Cursor } from './cursor';

/** Words that may start a line. Error recovery skips ahead to one of these. */
const STARTERS = new Set(['let', 'reward', 'stop', 'if', 'repeat', 'for', 'each', 'sensor', 'script']);

export const tokenSpan = (t: Token): Span => ({ from: t.from, to: t.to });

/**
 * Parses one line-level construct (a statement or a top-level item) and
 * attaches its comments. On a syntax error the construct is dropped and the
 * cursor skips to the next line that looks like a fresh start, so one typo
 * produces one error instead of a cascade.
 */
export function parseLine<T extends Trivia & { span: Span }>(c: Cursor, first: boolean, topLevel: boolean, body: () => T): T | null {
  const start = c.peek();
  const startIndex = c.index;
  const mark = c.hoisted.length;
  const depth = c.depth;
  const leading = c.claim(start.from);
  const blank = !first && c.blankBefore(leading[0]?.span.from ?? start.from);
  try {
    const node = body();
    finishLine(c, node, leading, blank, mark);
    return node;
  } catch (e) {
    if (!(e instanceof ParseFail)) throw e;
    c.depth = depth;
    c.hoisted.length = mark;
    recover(c, startIndex, topLevel);
    return null;
  }
}

function finishLine(c: Cursor, node: Trivia & { span: Span }, leading: Comment[], blank: boolean, mark: number): void {
  const last = c.prev();
  const inner = c.claim(last.to);
  node.leading = [...leading, ...c.hoisted.splice(mark), ...inner];
  node.trailing = c.trailingAfter(last);
  node.blankBefore = blank;
  const next = c.peek();
  if (next.kind !== 'eof' && next.line === last.line && !(next.kind === 'punct' && next.text === '}')) {
    c.error('Start a new line for the next statement.', tokenSpan(next), 'same-line', [insertFix('Break the line', next.from, '\n')]);
  }
}

function recover(c: Cursor, startIndex: number, topLevel: boolean): void {
  if (c.index === startIndex) c.next();
  let braces = 0;
  let parens = 0;
  while (!c.done) {
    const t = c.peek();
    if (braces <= 0 && c.atLineStart()) {
      if (t.kind === 'keyword' && STARTERS.has(t.text)) return;
      if (t.kind === 'ident' && (topLevel ? t.text === 'brain' : parens <= 0)) return;
    }
    if (braces <= 0 && !topLevel && t.kind === 'punct' && t.text === '}') return;
    if (t.kind === 'punct') {
      if (t.text === '{') braces++;
      else if (t.text === '}') braces--;
      else if (t.text === '(') parens++;
      else if (t.text === ')') parens--;
    }
    c.next();
  }
}

/**
 * Accepts `word` as a keyword, or a near miss of it on the same line, which
 * is reported with a fix and then treated as the real word.
 */
export function eatWord(c: Cursor, word: string): boolean {
  if (c.eat('keyword', word)) return true;
  const t = c.peek();
  if (t.kind !== 'ident' || t.line !== c.prev().line) return false;
  if (bestSuggestion(t.text, [word]) !== word) return false;
  c.error(`Unknown word ${t.text}. Did you mean ${word}?`, tokenSpan(t), 'keyword-typo', [replaceFix(`Change to ${word}`, t, word)]);
  c.next();
  return true;
}

/** If `t` is a misspelled keyword from `words`, reports it with a fix and returns the keyword. */
export function keywordTypo(c: Cursor, t: Token, words: readonly string[]): string | null {
  const best = bestSuggestion(t.text, words);
  if (!best) return null;
  c.error(`Unknown word ${t.text}. Did you mean ${best}?`, tokenSpan(t), 'keyword-typo', [replaceFix(`Change to ${best}`, t, best)]);
  return best;
}

/** End of the line holding `offset`, where a missing `}` can be inserted without swallowing a comment. */
export function lineEnd(source: string, offset: number): number {
  const nl = source.indexOf('\n', offset);
  return nl < 0 ? source.length : nl;
}
