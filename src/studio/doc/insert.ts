import { emptyTrivia, parse, print, type EachItem, type EventName, type Item, type Stmt } from '@/engine/script';

export type InsertScope = 'top' | EventName;

/**
 * Puts a snippet on its own line below the cursor's line, indented like
 * that line, or one level deeper when the line opens a block. A blank line
 * is reused instead of leaving it behind. Returns the new text and where
 * the cursor should land.
 */
export function insertBelowLine(source: string, offset: number, snippet: string): { text: string; cursor: number } {
  const at = Math.max(0, Math.min(offset, source.length));
  const lineStart = source.lastIndexOf('\n', at - 1) + 1;
  const nl = source.indexOf('\n', at);
  const lineEnd = nl === -1 ? source.length : nl;
  const line = source.slice(lineStart, lineEnd);
  let indent = /^\s*/.exec(line)?.[0] ?? '';
  if (line.trimEnd().endsWith('{')) indent += '  ';
  const body = snippet
    .split('\n')
    .map((l) => (l.length > 0 ? indent + l : l))
    .join('\n');
  if (line.trim() === '') {
    const text = source.slice(0, lineStart) + body + source.slice(lineEnd);
    return { text, cursor: lineStart + body.length };
  }
  const text = `${source.slice(0, lineEnd)}\n${body}${source.slice(lineEnd)}`;
  return { text, cursor: lineEnd + 1 + body.length };
}

function snippetItems(snippet: string, scope: InsertScope, env: string): Item[] | Stmt[] | null {
  const wrapper = scope === 'top' ? `script "x" for ${env} v1\n${snippet}\n` : `script "x" for ${env} v1\neach ${scope} {\n${snippet}\n}\n`;
  const parsed = parse(wrapper);
  if (parsed.diagnostics.some((d) => d.severity === 'error')) return null;
  if (scope === 'top') return parsed.program.items;
  const each = parsed.program.items[0];
  return each?.kind === 'each' ? each.body.stmts : null;
}

/**
 * Appends a snippet to the end of a section, the way the blocks view adds
 * an example: into `each tick` or `each generation`, creating that block
 * when the script has none, or at the top level. Returns null when either
 * text has a syntax error, since a broken tree cannot be printed safely.
 */
export function appendToSection(source: string, scope: InsertScope, snippet: string): string | null {
  const parsed = parse(source);
  if (parsed.diagnostics.some((d) => d.severity === 'error')) return null;
  const program = parsed.program;
  const added = snippetItems(snippet, scope, program.header?.env ?? 'racing');
  if (!added) return null;
  if (scope === 'top') {
    const firstEach = program.items.findIndex((i) => i.kind === 'each');
    const items = [...program.items];
    items.splice(firstEach === -1 ? items.length : firstEach, 0, ...(added as Item[]));
    return print({ ...program, items });
  }
  const stmts = added as Stmt[];
  const index = program.items.findIndex((i) => i.kind === 'each' && i.event === scope);
  if (index === -1) {
    const span = { from: 0, to: 0 };
    const fresh: EachItem = { kind: 'each', event: scope, body: { stmts, openComment: null, dangling: [], span }, span, ...emptyTrivia(), blankBefore: true };
    return print({ ...program, items: [...program.items, fresh] });
  }
  const each = program.items[index] as EachItem;
  const items = [...program.items];
  items[index] = { ...each, body: { ...each.body, stmts: [...each.body.stmts, ...stmts] } };
  return print({ ...program, items });
}
