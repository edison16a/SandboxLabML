import type { Block, Comment, IfStmt, Item, Program, Stmt, Trivia } from './ast';
import { formatNumber, printExpr, quote } from './printExpr';

export { formatNumber, printExpr } from './printExpr';

export interface PrintOptions {
  /** Set to false to drop comments and blank lines, which is how the source hash ignores them. */
  comments?: boolean;
}

const INDENT = '  ';

/**
 * The canonical formatter: two space indent, one statement per line, at
 * most one blank line in a row, comments kept where they were. Printing is
 * stable: `print(parse(print(x)))` equals `print(x)`.
 */
export function print(program: Program, opts: PrintOptions = {}): string {
  const p = new Printer(opts.comments !== false);
  p.program(program);
  return p.text();
}

/** Prints one statement at the given depth. The block view uses it for previews. */
export function printStmt(stmt: Stmt, indent = 0, opts: PrintOptions = {}): string {
  const p = new Printer(opts.comments !== false);
  p.stmt(stmt, indent);
  return p.text().replace(/\n$/, '');
}

class Printer {
  private lines: string[] = [];

  constructor(private readonly keepComments: boolean) {}

  text(): string {
    return this.lines.length === 0 ? '' : `${this.lines.join('\n')}\n`;
  }

  private line(indent: number, text: string, trailing: Comment | null = null): void {
    const comment = trailing && this.keepComments ? ` ${commentText(trailing)}` : '';
    this.lines.push(INDENT.repeat(indent) + text + comment);
  }

  private comments(indent: number, list: Comment[]): void {
    if (!this.keepComments) return;
    for (const c of list) this.line(indent, commentText(c));
  }

  /** Blank line and leading comments for one line of code. */
  private before(indent: number, t: Trivia): void {
    if (t.blankBefore && this.keepComments && this.lines.length > 0) this.lines.push('');
    this.comments(indent, t.leading);
  }

  program(prog: Program): void {
    if (prog.header) {
      const h = prog.header;
      this.before(0, h);
      this.line(0, `script ${quote(h.name)} for ${h.env} v${h.version}`, h.trailing);
    }
    if (prog.brain) {
      this.before(0, prog.brain);
      this.line(0, `brain ${prog.brain.id}`, prog.brain.trailing);
    }
    for (const item of prog.items) this.item(item);
    this.comments(0, prog.dangling);
  }

  private item(item: Item): void {
    if (item.kind === 'let') return this.stmt(item, 0);
    this.before(0, item);
    if (item.kind === 'sensor') {
      const head = `sensor ${item.name} ${quote(item.label)} in ${printExpr(item.lo)} .. ${printExpr(item.hi)}`;
      this.line(0, `${head} = ${printExpr(item.value)}`, item.trailing);
      return;
    }
    this.block(0, `each ${item.event} {`, item.body, item.trailing);
  }

  stmt(s: Stmt, indent: number): void {
    this.before(indent, s);
    switch (s.kind) {
      case 'let':
        return this.line(indent, `let ${s.name} = ${printExpr(s.value)}`, s.trailing);
      case 'reward':
        return this.line(indent, `reward ${printExpr(s.value)}${s.when ? ` when ${printExpr(s.when)}` : ''}`, s.trailing);
      case 'stop':
        return this.line(indent, `stop ${quote(s.reason)} when ${printExpr(s.when)}`, s.trailing);
      case 'expr':
        return this.line(indent, printExpr(s.expr), s.trailing);
      case 'repeat':
        return this.block(indent, `repeat ${formatNumber(s.count)} {`, s.body, s.trailing);
      case 'forEach':
        return this.block(indent, `for each ${s.variable} in ${s.collection} {`, s.body, s.trailing);
      case 'if':
        return this.ifChain(s, indent, '', s.trailing);
    }
  }

  /** `} else if` chains print flat. The comment after the last `}` belongs to the outermost if. */
  private ifChain(s: IfStmt, indent: number, prefix: string, trailing: Comment | null): void {
    this.line(indent, `${prefix}if ${printExpr(s.cond)} {`, s.then.openComment);
    this.body(s.then, indent + 1);
    const end = trailing ?? s.trailing;
    if (s.else === null) return this.line(indent, '}', end);
    if ('kind' in s.else) return this.ifChain(s.else, indent, '} else ', end);
    this.line(indent, '} else {', s.else.openComment);
    this.body(s.else, indent + 1);
    this.line(indent, '}', end);
  }

  private block(indent: number, head: string, b: Block, trailing: Comment | null): void {
    this.line(indent, head, b.openComment);
    this.body(b, indent + 1);
    this.line(indent, '}', trailing);
  }

  private body(b: Block, indent: number): void {
    for (const s of b.stmts) this.stmt(s, indent);
    this.comments(indent, b.dangling);
  }
}

function commentText(c: Comment): string {
  return c.text === '' ? '//' : `// ${c.text}`;
}
