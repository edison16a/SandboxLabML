import { insertFix, makeDiagnostic, type Diagnostic } from './diagnostics';
import { UNIT_SPELLINGS, type UnitName } from './units';

export type TokenKind = 'keyword' | 'ident' | 'number' | 'unit' | 'string' | 'comment' | 'op' | 'punct' | 'invalid' | 'eof';

export interface Token {
  kind: TokenKind;
  text: string;
  from: number;
  to: number;
  /** 0-based line of the first character. Tokens never span lines. */
  line: number;
  /** Parsed value: the number, the unescaped string, the unit name or the comment body. */
  value?: number | string;
}

/**
 * Reserved words. `brain`, `tick` and `generation` are left out on purpose:
 * `brain.steer` and the `generation` counter are ordinary names, so the
 * parser treats those three as keywords only where the grammar needs them.
 */
export const KEYWORDS: ReadonlySet<string> = new Set([
  'script', 'for', 'sensor', 'in', 'let', 'each', 'reward', 'when', 'stop',
  'if', 'else', 'repeat', 'true', 'false', 'and', 'or', 'not',
]);

/** `&&` and `||` are lexed so the parser can say "use and", but they are not part of the language. */
const OPS2 = new Set(['<=', '>=', '==', '!=', '..', '&&', '||']);
const OPS1 = '+-*/%<>=';
const PUNCT = '(){},:.';

export interface LexResult {
  tokens: Token[];
  comments: Token[];
  diagnostics: Diagnostic[];
}

const isDigit = (c: number) => c >= 48 && c <= 57;
const isIdentStart = (c: number) => (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || c === 95;
export const isIdentPart = (c: number) => isIdentStart(c) || isDigit(c);

/**
 * Splits source into tokens. Never throws: anything unexpected becomes an
 * `invalid` token and the parser explains it. Comments are returned on the
 * side so the parser can attach them to statements.
 */
export function lex(source: string): LexResult {
  const tokens: Token[] = [];
  const comments: Token[] = [];
  const diagnostics: Diagnostic[] = [];
  const n = source.length;
  let i = 0;
  let line = 0;
  const push = (kind: TokenKind, from: number, to: number, value?: number | string) => {
    const t: Token = { kind, text: source.slice(from, to), from, to, line };
    if (value !== undefined) t.value = value;
    (kind === 'comment' ? comments : tokens).push(t);
  };

  while (i < n) {
    const c = source.charCodeAt(i);
    const ch = source[i];
    if (c === 10) {
      line++;
      i++;
    } else if (c === 32 || c === 9 || c === 13) {
      i++;
    } else if (ch === '/' && source[i + 1] === '/') {
      let j = i + 2;
      while (j < n && source.charCodeAt(j) !== 10) j++;
      push('comment', i, j, source.slice(i + 2, j).trim());
      i = j;
    } else if (isDigit(c)) {
      i = lexNumber(source, i, push, diagnostics);
    } else if (isIdentStart(c)) {
      let j = i + 1;
      while (j < n && isIdentPart(source.charCodeAt(j))) j++;
      const text = source.slice(i, j);
      push(KEYWORDS.has(text) ? 'keyword' : 'ident', i, j);
      i = j;
    } else if (ch === '"') {
      i = lexString(source, i, push, diagnostics);
    } else if (OPS2.has(source.slice(i, i + 2))) {
      const two = source.slice(i, i + 2);
      push(two === '&&' || two === '||' ? 'invalid' : 'op', i, i + 2);
      i += 2;
    } else if (OPS1.includes(ch)) {
      push('op', i, i + 1);
      i++;
    } else {
      // Keep surrogate pairs together so an emoji is one invalid token, not two halves.
      const width = c >= 0xd800 && c <= 0xdbff && i + 1 < n ? 2 : 1;
      push(PUNCT.includes(ch) ? 'punct' : 'invalid', i, i + width);
      i += width;
    }
  }
  push('eof', n, n);
  return { tokens, comments, diagnostics };
}

type Push = (kind: TokenKind, from: number, to: number, value?: number | string) => void;

/**
 * A number, then an optional unit. A unit may follow after spaces on the
 * same line (`5 s`, `2 m/s2`), and `%` must touch the number (`20%`) so it
 * cannot be confused with the remainder operator in `generation % 10`.
 */
function lexNumber(source: string, start: number, push: Push, diagnostics: Diagnostic[]): number {
  const n = source.length;
  let j = start;
  while (j < n && isDigit(source.charCodeAt(j))) j++;
  if (source[j] === '.' && isDigit(source.charCodeAt(j + 1))) {
    j++;
    while (j < n && isDigit(source.charCodeAt(j))) j++;
  }
  if (source[j] === 'e' || source[j] === 'E') {
    let k = j + 1;
    if (source[k] === '+' || source[k] === '-') k++;
    if (isDigit(source.charCodeAt(k))) {
      j = k;
      while (j < n && isDigit(source.charCodeAt(j))) j++;
    }
  }
  let value = Number(source.slice(start, j));
  if (!Number.isFinite(value)) {
    diagnostics.push(makeDiagnostic('error', 'number-too-large', 'This number is too large.', { from: start, to: j }));
    value = 0;
  }
  push('number', start, j, value);
  if (source[j] === '%') {
    push('unit', j, j + 1, '%');
    return j + 1;
  }
  let k = j;
  while (source[k] === ' ' || source[k] === '\t') k++;
  for (const [spelling, unit] of UNIT_SPELLINGS) {
    const end = k + spelling.length;
    if (source.startsWith(spelling, k) && !isIdentPart(source.charCodeAt(end))) {
      push('unit', k, end, unit satisfies UnitName);
      return end;
    }
  }
  return j;
}

function lexString(source: string, start: number, push: Push, diagnostics: Diagnostic[]): number {
  let j = start + 1;
  let value = '';
  while (j < source.length && source[j] !== '"' && source[j] !== '\n') {
    if (source[j] === '\\' && j + 1 < source.length && source[j + 1] !== '\n') {
      const e = source[j + 1];
      value += e === 'n' ? '\n' : e === 't' ? '\t' : e;
      j += 2;
    } else {
      value += source[j++];
    }
  }
  if (source[j] === '"') {
    push('string', start, j + 1, value);
    return j + 1;
  }
  diagnostics.push(
    makeDiagnostic('error', 'unterminated-string', 'This text has no closing quote.', { from: start, to: j }, [
      insertFix('Add the closing quote', j, '"'),
    ]),
  );
  push('string', start, j, value);
  return j;
}
