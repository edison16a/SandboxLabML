import type { Comment } from '../ast';
import { makeDiagnostic, type Diagnostic, type QuickFix, type Span } from '../diagnostics';
import type { Token, TokenKind } from '../lexer';

/** Thrown inside the parser to abandon one statement. Never escapes `parse`. */
export class ParseFail extends Error {}

/** How deep blocks, parentheses and unary chains may nest before the parser gives up. */
export const MAX_NESTING = 100;

/**
 * A position in the token list plus the comment bookkeeping. Comments are
 * kept apart from tokens and handed out in source order with `claim`, so
 * every comment ends up attached to exactly one statement or block.
 */
export class Cursor {
  private pos = 0;
  private nextComment = 0;
  /** Comments found inside a statement. They become its leading comments when it ends. */
  readonly hoisted: Comment[] = [];
  depth = 0;
  /** Set while parsing a sensor's upper bound, where `=` is the real assignment, not a typo for `==`. */
  allowAssign = false;

  constructor(
    readonly source: string,
    private readonly tokens: Token[],
    private readonly comments: Token[],
    readonly diagnostics: Diagnostic[],
  ) {}

  peek(offset = 0): Token {
    return this.tokens[Math.min(this.pos + offset, this.tokens.length - 1)];
  }

  prev(): Token {
    return this.tokens[Math.max(0, this.pos - 1)];
  }

  get done(): boolean {
    return this.peek().kind === 'eof';
  }

  next(): Token {
    const t = this.peek();
    if (t.kind !== 'eof') this.pos++;
    return t;
  }

  /** Index of the next token, used to check that error recovery made progress. */
  get index(): number {
    return this.pos;
  }

  is(kind: TokenKind, text?: string, offset = 0): boolean {
    const t = this.peek(offset);
    return t.kind === kind && (text === undefined || t.text === text);
  }

  isPunct(text: string, offset = 0): boolean {
    return this.is('punct', text, offset);
  }

  isKeyword(text: string, offset = 0): boolean {
    return this.is('keyword', text, offset);
  }

  eat(kind: TokenKind, text?: string): Token | null {
    return this.is(kind, text) ? this.next() : null;
  }

  expect(kind: TokenKind, text: string | undefined, message: string, fixes?: QuickFix[]): Token {
    const t = this.eat(kind, text);
    if (t) return t;
    return this.fail(message, this.spanHere(), 'syntax', fixes);
  }

  /** The span of the next token, or a zero-width span at the end of the previous one when at the end. */
  spanHere(): Span {
    const t = this.peek();
    if (t.kind === 'eof') return { from: this.prev().to, to: this.prev().to };
    return { from: t.from, to: t.to };
  }

  /** True when the next token is the first one on its line. */
  atLineStart(offset = 0): boolean {
    const i = this.pos + offset;
    return i === 0 || this.tokens[i - 1].line < this.peek(offset).line;
  }

  error(message: string, span: Span, code = 'syntax', fixes?: QuickFix[]): void {
    this.diagnostics.push(makeDiagnostic('error', code, message, span, fixes));
  }

  fail(message: string, span: Span, code = 'syntax', fixes?: QuickFix[]): never {
    this.error(message, span, code, fixes);
    throw new ParseFail(message);
  }

  enter(span: Span): void {
    if (++this.depth > MAX_NESTING) this.fail('This is nested too deeply. Split it into smaller steps with let.', span, 'too-deep');
  }

  leave(): void {
    this.depth--;
  }

  /** Hands out every unclaimed comment that starts before `offset`. */
  claim(offset: number): Comment[] {
    const out: Comment[] = [];
    while (this.nextComment < this.comments.length && this.comments[this.nextComment].from < offset) {
      const c = this.comments[this.nextComment++];
      out.push({ text: String(c.value ?? ''), span: { from: c.from, to: c.to } });
    }
    return out;
  }

  /** The comment at the end of `tok`'s line, if nothing else sits between them. */
  trailingAfter(tok: Token): Comment | null {
    const c = this.comments[this.nextComment];
    if (!c || c.line !== tok.line || c.from < tok.to) return null;
    const next = this.peek();
    if (next.kind !== 'eof' && next.from < c.from) return null;
    return this.claim(c.from + 1)[0] ?? null;
  }

  /** Whether a blank line sits right before `offset`, skipping only whitespace. */
  blankBefore(offset: number): boolean {
    let newlines = 0;
    for (let i = offset - 1; i >= 0; i--) {
      const ch = this.source.charCodeAt(i);
      if (ch === 10) newlines++;
      else if (ch !== 32 && ch !== 9 && ch !== 13) break;
      if (newlines >= 2) return true;
    }
    return false;
  }
}
