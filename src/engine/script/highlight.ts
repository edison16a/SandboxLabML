import { lex, type Token } from './lexer';

export type HighlightKind = 'keyword' | 'ident' | 'number' | 'unit' | 'string' | 'comment' | 'operator' | 'punctuation' | 'invalid';

export interface HighlightSpan {
  from: number;
  to: number;
  kind: HighlightKind;
}

const KIND: Record<Token['kind'], HighlightKind> = {
  keyword: 'keyword',
  ident: 'ident',
  number: 'number',
  unit: 'unit',
  string: 'string',
  comment: 'comment',
  op: 'operator',
  punct: 'punctuation',
  invalid: 'invalid',
  eof: 'invalid',
};

/**
 * Labels every token for syntax highlighting. It runs on each keystroke, so
 * it uses the lexer alone and never throws, even on half-typed text. The
 * contextual words get their keyword color here: `brain` on its own line,
 * and `tick` or `generation` right after `each`. A brain id such as
 * `racing-starter` is merged into one span.
 */
export function tokenize(source: string): HighlightSpan[] {
  try {
    const { tokens, comments } = lex(source);
    const spans: HighlightSpan[] = [];
    for (let i = 0; i < tokens.length; i++) {
      const t = tokens[i];
      if (t.kind === 'eof') break;
      let kind = KIND[t.kind];
      const prev = tokens[i - 1];
      const next = tokens[i + 1];
      if (t.kind === 'ident' && prev?.kind === 'keyword' && prev.text === 'each' && (t.text === 'tick' || t.text === 'generation')) {
        kind = 'keyword';
      }
      if (t.kind === 'ident' && t.text === 'brain' && (!prev || prev.line < t.line) && !(next?.kind === 'punct' && next.text === '.')) {
        spans.push({ from: t.from, to: t.to, kind: 'keyword' });
        let j = i + 1;
        while (j < tokens.length && isIdPart(tokens[j]) && tokens[j].line === t.line && (j === i + 1 || tokens[j].from === tokens[j - 1].to)) j++;
        if (j > i + 1) spans.push({ from: tokens[i + 1].from, to: tokens[j - 1].to, kind: 'ident' });
        i = j - 1;
        continue;
      }
      spans.push({ from: t.from, to: t.to, kind });
    }
    for (const c of comments) spans.push({ from: c.from, to: c.to, kind: 'comment' });
    return spans.sort((a, b) => a.from - b.from);
  } catch {
    return source.length > 0 ? [{ from: 0, to: source.length, kind: 'invalid' }] : [];
  }
}

function isIdPart(t: Token): boolean {
  return t.kind === 'ident' || t.kind === 'number' || t.kind === 'keyword' || (t.kind === 'op' && t.text === '-');
}
