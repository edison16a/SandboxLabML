import { hashString } from '../../core/hash';
import type { Arg, Block as AstBlock, Comment, Expr, IfStmt, Item, Program, Stmt, Trivia } from '../ast';
import { print, printExpr, printStmt } from '../printer';
import type { ScriptBlock, BlockInput, BlockMeta, BlockWorkspace } from './types';

/** Comment lines joined by newlines. Null and the empty string stay distinct so `//` alone survives. */
export function joinComments(list: Comment[]): string | null {
  return list.length === 0 ? null : list.map((c) => c.text).join('\n');
}

/**
 * Hands out ids for one list of siblings. The id mixes the parent id, the
 * slot, the block's own head text and how many identical siblings came
 * before it, so editing one statement leaves the ids of the others alone.
 */
class IdScope {
  private seen = new Map<string, number>();
  constructor(private readonly parent: string) {}

  id(slot: string, content: string): string {
    const key = `${slot}\u0000${content}`;
    const n = this.seen.get(key) ?? 0;
    this.seen.set(key, n + 1);
    return `b${hashString(`${this.parent}/${key}#${n}`)}`;
  }
}

function withMeta(block: ScriptBlock, meta: BlockMeta): ScriptBlock {
  const clean = Object.fromEntries(Object.entries(meta).filter(([, v]) => v !== undefined && v !== null)) as BlockMeta;
  if (Object.keys(clean).length > 0) block.meta = clean;
  return block;
}

function trivia(t: Trivia): BlockMeta {
  return { trailing: t.trailing?.text, blankBefore: t.blankBefore ? true : undefined };
}

function bodyMeta(b: AstBlock, prefix: 'open' | 'else'): BlockMeta {
  const dangling = joinComments(b.dangling) ?? undefined;
  return prefix === 'open' ? { open: b.openComment?.text, dangling } : { elseOpen: b.openComment?.text, elseDangling: dangling };
}

/** Converts a program into the block workspace. */
export function toBlocks(program: Program): BlockWorkspace {
  const top = new IdScope('root');
  const h = program.header;
  const header = h
    ? withMeta({ id: top.id('header', `${h.name} ${h.env} ${h.version}`), type: 'script', fields: { name: h.name, env: h.env, version: h.version }, inputs: [], children: {}, comment: joinComments(h.leading) }, trivia(h))
    : null;
  const b = program.brain;
  const brain = b ? withMeta({ id: top.id('brain', b.id), type: 'brain', fields: { id: b.id }, inputs: [], children: {}, comment: joinComments(b.leading) }, trivia(b)) : null;
  return { version: 1, header, brain, items: program.items.map((item) => itemBlock(item, top)), trailing: joinComments(program.dangling) };
}

function itemBlock(item: Item, ids: IdScope): ScriptBlock {
  if (item.kind === 'let') return stmtBlock(item, ids, 'items');
  if (item.kind === 'sensor') {
    const id = ids.id('items', print({ header: null, brain: null, items: [item], dangling: [] }, { comments: false }));
    const inputs = [input(id, 'lo', item.lo, 0), input(id, 'hi', item.hi, 1), input(id, 'value', item.value, 2)];
    return withMeta({ id, type: 'sensor', fields: { name: item.name, label: item.label }, inputs, children: {}, comment: joinComments(item.leading) }, trivia(item));
  }
  const id = ids.id('items', `each ${item.event}`);
  const block: ScriptBlock = { id, type: 'each', fields: { event: item.event }, inputs: [], children: { body: list(id, 'body', item.body) }, comment: joinComments(item.leading) };
  return withMeta(block, { ...trivia(item), ...bodyMeta(item.body, 'open') });
}

function list(parent: string, slot: string, b: AstBlock): ScriptBlock[] {
  const ids = new IdScope(parent);
  return b.stmts.map((s) => stmtBlock(s, ids, slot));
}

/** The text a statement is identified by: the whole line for simple statements, only the head for ones with a body. */
function head(s: Stmt): string {
  switch (s.kind) {
    case 'if':
      return `if ${printExpr(s.cond)}`;
    case 'repeat':
      return `repeat ${s.count}`;
    case 'forEach':
      return `for each ${s.variable} in ${s.collection}`;
    default:
      return printStmt(s, 0, { comments: false });
  }
}

function stmtBlock(s: Stmt, ids: IdScope, slot: string): ScriptBlock {
  const id = ids.id(slot, head(s));
  const base = { id, comment: joinComments(s.leading), children: {} as Record<string, ScriptBlock[]> };
  switch (s.kind) {
    case 'let':
      return withMeta({ ...base, type: 'let', fields: { name: s.name }, inputs: [input(id, 'value', s.value, 0)] }, trivia(s));
    case 'reward':
      return withMeta({ ...base, type: 'reward', fields: {}, inputs: [input(id, 'value', s.value, 0), input(id, 'when', s.when, 1)] }, trivia(s));
    case 'stop':
      return withMeta({ ...base, type: 'stop', fields: { reason: s.reason }, inputs: [input(id, 'when', s.when, 0)] }, trivia(s));
    case 'repeat':
      return withMeta({ ...base, type: 'repeat', fields: { count: s.count }, inputs: [], children: { body: list(id, 'body', s.body) } }, { ...trivia(s), ...bodyMeta(s.body, 'open') });
    case 'forEach': {
      const fields = { variable: s.variable, collection: s.collection };
      return withMeta({ ...base, type: 'forEach', fields, inputs: [], children: { body: list(id, 'body', s.body) } }, { ...trivia(s), ...bodyMeta(s.body, 'open') });
    }
    case 'if':
      return ifBlock(s, id, base.comment, trivia(s));
    case 'expr': {
      const e = s.expr;
      if (e.kind === 'call' && e.callee.kind === 'name') {
        return withMeta({ ...base, type: 'call', fields: { name: e.callee.path.join('.') }, inputs: args(id, e.args) }, trivia(s));
      }
      return withMeta({ ...base, type: 'expression', fields: {}, inputs: [input(id, 'value', e, 0)] }, trivia(s));
    }
  }
}

function ifBlock(s: IfStmt, id: string, comment: string | null, meta: BlockMeta): ScriptBlock {
  const children: Record<string, ScriptBlock[]> = { then: list(id, 'then', s.then) };
  let elseIf = false;
  let elseMeta: BlockMeta = {};
  if (s.else && 'kind' in s.else) {
    elseIf = true;
    const inner = s.else;
    children.else = [ifBlock(inner, new IdScope(id).id('else', head(inner)), null, trivia(inner))];
  } else if (s.else) {
    children.else = list(id, 'else', s.else);
    elseMeta = bodyMeta(s.else, 'else');
  }
  const block: ScriptBlock = { id, type: 'if', fields: { elseIf }, inputs: [input(id, 'cond', s.cond, 0)], children, comment };
  return withMeta(block, { ...meta, ...bodyMeta(s.then, 'open'), ...elseMeta });
}

function args(parent: string, list: Arg[]): BlockInput[] {
  return list.map((a, i) => input(parent, a.name ?? '', a.value, i));
}

function input(parent: string, name: string, e: Expr | null, index: number): BlockInput {
  return { name, block: e ? valueBlock(e, `${parent}/${index}:${name}`) : null };
}

/** Value blocks are identified by their slot and their own printed text. */
function valueBlock(e: Expr, slot: string): ScriptBlock {
  const id = `v${hashString(`${slot}\u0000${printExpr(e)}`)}`;
  const base = { id, children: {}, comment: null };
  switch (e.kind) {
    case 'number':
      return { ...base, type: 'number', fields: { value: e.value, unit: e.unit }, inputs: [] };
    case 'string':
      return { ...base, type: 'text', fields: { value: e.value }, inputs: [] };
    case 'bool':
      return { ...base, type: 'boolean', fields: { value: e.value }, inputs: [] };
    case 'name':
      return { ...base, type: 'name', fields: { name: e.path.join('.') }, inputs: [] };
    case 'unary':
      return { ...base, type: 'unary', fields: { op: e.op }, inputs: [input(id, 'operand', e.operand, 0)] };
    case 'binary':
      return { ...base, type: 'binary', fields: { op: e.op }, inputs: [input(id, 'left', e.left, 0), input(id, 'right', e.right, 1)] };
    case 'record':
      return { ...base, type: 'settings', fields: {}, inputs: args(id, e.fields) };
    case 'call': {
      if (e.callee.kind === 'name') return { ...base, type: 'callValue', fields: { name: e.callee.path.join('.') }, inputs: args(id, e.args) };
      return { ...base, type: 'callValue', fields: { name: '' }, inputs: [input(id, '$callee', e.callee, 0), ...args(`${id}+`, e.args)] };
    }
  }
}
