import type { Arg, Block as AstBlock, BinaryOp, Comment, EventName, Expr, IfStmt, Item, Program, Stmt, Trivia, UnaryOp } from '../ast';
import type { Span } from '../diagnostics';
import type { UnitName } from '../units';
import type { ScriptBlock, BlockMeta, BlockWorkspace } from './types';

/** Value written for an empty required slot. It prints as `_`, which the checker reports as an unknown name. */
export const HOLE = '_';

const span = (): Span => ({ from: 0, to: 0 });

export function splitComments(text: string | null | undefined): Comment[] {
  return text === null || text === undefined ? [] : text.split('\n').map((t) => ({ text: t, span: span() }));
}

const comment = (text: string | undefined): Comment | null => (text === undefined ? null : { text, span: span() });
const str = (b: ScriptBlock, key: string) => String(b.fields[key] ?? '');
const inputOf = (b: ScriptBlock, name: string) => b.inputs.find((i) => i.name === name)?.block ?? null;

function trivia(b: ScriptBlock): Trivia {
  return { leading: splitComments(b.comment), trailing: comment(b.meta?.trailing), blankBefore: b.meta?.blankBefore === true };
}

function body(blocks: ScriptBlock[] | undefined, open: string | undefined, dangling: string | undefined): AstBlock {
  return { stmts: (blocks ?? []).map(stmtFrom), openComment: comment(open), dangling: splitComments(dangling), span: span() };
}

/** Converts a block workspace back into a program. Exact inverse of toBlocks. */
export function fromBlocks(ws: BlockWorkspace): Program {
  const h = ws.header;
  const b = ws.brain;
  return {
    header: h ? { name: str(h, 'name'), env: str(h, 'env'), envSpan: span(), version: Number(h.fields.version ?? 1), span: span(), ...trivia(h) } : null,
    brain: b ? { id: str(b, 'id'), idSpan: span(), span: span(), ...trivia(b) } : null,
    items: ws.items.map(itemFrom),
    dangling: splitComments(ws.trailing),
  };
}

function itemFrom(b: ScriptBlock): Item {
  if (b.type === 'sensor') {
    return {
      kind: 'sensor',
      name: str(b, 'name'),
      nameSpan: span(),
      label: str(b, 'label'),
      lo: value(inputOf(b, 'lo')),
      hi: value(inputOf(b, 'hi')),
      value: value(inputOf(b, 'value')),
      span: span(),
      ...trivia(b),
    };
  }
  if (b.type === 'each') {
    const meta: BlockMeta = b.meta ?? {};
    return { kind: 'each', event: str(b, 'event') as EventName, body: body(b.children.body, meta.open, meta.dangling), span: span(), ...trivia(b) };
  }
  const s = stmtFrom(b);
  if (s.kind !== 'let') throw new Error(`A ${b.type} block cannot sit at the top level.`);
  return s;
}

function stmtFrom(b: ScriptBlock): Stmt {
  const base = { span: span(), ...trivia(b) };
  const meta: BlockMeta = b.meta ?? {};
  switch (b.type) {
    case 'let':
      return { kind: 'let', name: str(b, 'name'), nameSpan: span(), value: value(inputOf(b, 'value')), ...base };
    case 'reward': {
      const when = inputOf(b, 'when');
      return { kind: 'reward', value: value(inputOf(b, 'value')), when: when ? value(when) : null, ...base };
    }
    case 'stop':
      return { kind: 'stop', reason: str(b, 'reason'), reasonSpan: span(), when: value(inputOf(b, 'when')), ...base };
    case 'repeat':
      return { kind: 'repeat', count: Number(b.fields.count ?? 1), countSpan: span(), body: body(b.children.body, meta.open, meta.dangling), ...base };
    case 'forEach':
      return {
        kind: 'forEach',
        variable: str(b, 'variable'),
        variableSpan: span(),
        collection: str(b, 'collection'),
        collectionSpan: span(),
        body: body(b.children.body, meta.open, meta.dangling),
        ...base,
      };
    case 'if':
      return ifFrom(b);
    case 'call':
      return { kind: 'expr', expr: { kind: 'call', callee: nameExpr(str(b, 'name')), args: argsFrom(b), span: span() }, ...base };
    case 'expression':
      return { kind: 'expr', expr: value(inputOf(b, 'value')), ...base };
    default:
      throw new Error(`A ${b.type} block is a value and cannot stand on its own line.`);
  }
}

function ifFrom(b: ScriptBlock): IfStmt {
  const meta: BlockMeta = b.meta ?? {};
  const elseList = b.children.else;
  let otherwise: AstBlock | IfStmt | null = null;
  if (elseList && b.fields.elseIf === true && elseList[0]) otherwise = ifFrom(elseList[0]);
  else if (elseList) otherwise = body(elseList, meta.elseOpen, meta.elseDangling);
  return {
    kind: 'if',
    cond: value(inputOf(b, 'cond')),
    then: body(b.children.then, meta.open, meta.dangling),
    else: otherwise,
    span: span(),
    ...trivia(b),
  };
}

function nameExpr(name: string): Expr {
  return { kind: 'name', path: name.split('.'), span: span() };
}

function argsFrom(b: ScriptBlock): Arg[] {
  return b.inputs.filter((i) => i.name !== '$callee').map((i) => ({ name: i.name === '' ? null : i.name, value: value(i.block), span: span() }));
}

function value(b: ScriptBlock | null): Expr {
  if (!b) return nameExpr(HOLE);
  switch (b.type) {
    case 'number':
      return { kind: 'number', value: Number(b.fields.value ?? 0), unit: str(b, 'unit') as UnitName, span: span() };
    case 'text':
      return { kind: 'string', value: str(b, 'value'), span: span() };
    case 'boolean':
      return { kind: 'bool', value: b.fields.value === true, span: span() };
    case 'name':
      return nameExpr(str(b, 'name'));
    case 'unary':
      return { kind: 'unary', op: str(b, 'op') as UnaryOp, operand: value(inputOf(b, 'operand')), span: span() };
    case 'binary':
      return { kind: 'binary', op: str(b, 'op') as BinaryOp, left: value(inputOf(b, 'left')), right: value(inputOf(b, 'right')), span: span(), opSpan: span() };
    case 'settings':
      return { kind: 'record', fields: argsFrom(b), span: span() };
    case 'callValue': {
      const callee = str(b, 'name') === '' ? value(inputOf(b, '$callee')) : nameExpr(str(b, 'name'));
      return { kind: 'call', callee, args: argsFrom(b), span: span() };
    }
    default:
      throw new Error(`A ${b.type} block is a statement and cannot be used as a value.`);
  }
}
