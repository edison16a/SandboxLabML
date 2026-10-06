import type { BinaryOp, Expr } from '../ast';
import { replaceFix, type Span } from '../diagnostics';
import type { Token } from '../lexer';
import type { Cursor } from './cursor';
import { parsePostfix } from './primary';

/** Expression trees deeper than this are refused, which keeps every later recursive pass safe. */
export const MAX_EXPR_DEPTH = 200;

const CMP_OPS = new Set(['<', '>', '<=', '>=', '==', '!=']);
const depthOf = new WeakMap<Expr, number>();

const span = (from: number, to: number): Span => ({ from, to });
const exprDepth = (e: Expr) => depthOf.get(e) ?? 1;

function binary(c: Cursor, op: BinaryOp, left: Expr, right: Expr, opTok: Token): Expr {
  const e: Expr = { kind: 'binary', op, left, right, span: span(left.span.from, right.span.to), opSpan: span(opTok.from, opTok.to) };
  const d = Math.max(exprDepth(left), exprDepth(right)) + 1;
  if (d > MAX_EXPR_DEPTH) c.fail('This expression is too long. Split it into parts with let.', e.span, 'too-deep');
  depthOf.set(e, d);
  return e;
}

/** Entry point: `or` has the lowest precedence. */
export function parseExpr(c: Cursor): Expr {
  let left = parseAnd(c);
  for (;;) {
    let op = c.eat('keyword', 'or');
    if (!op && c.is('invalid', '||')) {
      op = c.next();
      c.error('Use or instead of ||.', op, 'js-operator', [replaceFix('Change || to or', op, 'or')]);
    }
    if (!op) return left;
    left = binary(c, 'or', left, parseAnd(c), op);
  }
}

function parseAnd(c: Cursor): Expr {
  let left = parseNot(c);
  for (;;) {
    let op = c.eat('keyword', 'and');
    if (!op && c.is('invalid', '&&')) {
      op = c.next();
      c.error('Use and instead of &&.', op, 'js-operator', [replaceFix('Change && to and', op, 'and')]);
    }
    if (!op) return left;
    left = binary(c, 'and', left, parseNot(c), op);
  }
}

function parseNot(c: Cursor): Expr {
  let op = c.eat('keyword', 'not');
  if (!op && c.is('invalid', '!')) {
    op = c.next();
    c.error('Use not instead of !.', op, 'js-operator', [replaceFix('Change ! to not', op, 'not ')]);
  }
  if (!op) return parseCmp(c);
  c.enter(op);
  const operand = parseNot(c);
  c.leave();
  return { kind: 'unary', op: 'not', operand, span: span(op.from, operand.span.to) };
}

function parseCmp(c: Cursor): Expr {
  const left = parseSum(c);
  const t = c.peek();
  let op: BinaryOp | null = t.kind === 'op' && CMP_OPS.has(t.text) ? (t.text as BinaryOp) : null;
  if (!op && t.kind === 'op' && t.text === '=' && !c.allowAssign) {
    c.error('Use == to compare two values. A single = only names a value in let.', t, 'eq-typo', [replaceFix('Change = to ==', t, '==')]);
    op = '==';
  }
  if (!op) return left;
  c.next();
  const e = binary(c, op, left, parseSum(c), t);
  const after = c.peek();
  if (after.kind === 'op' && CMP_OPS.has(after.text)) {
    c.fail('Comparisons cannot be chained. Join two comparisons with and.', after, 'chained-compare');
  }
  return e;
}

function parseSum(c: Cursor): Expr {
  let left = parseTerm(c);
  while (c.is('op', '+') || c.is('op', '-')) {
    const op = c.next();
    left = binary(c, op.text as BinaryOp, left, parseTerm(c), op);
  }
  return left;
}

function parseTerm(c: Cursor): Expr {
  let left = parseUnary(c);
  while (c.is('op', '*') || c.is('op', '/') || c.is('op', '%')) {
    const op = c.next();
    left = binary(c, op.text as BinaryOp, left, parseUnary(c), op);
  }
  return left;
}

function parseUnary(c: Cursor): Expr {
  if (c.is('op', '-') || c.is('op', '+')) {
    const op = c.next();
    c.enter(op);
    const operand = parseUnary(c);
    c.leave();
    const e: Expr = { kind: 'unary', op: op.text as '-' | '+', operand, span: span(op.from, operand.span.to) };
    depthOf.set(e, exprDepth(operand) + 1);
    return e;
  }
  return parsePostfix(c, parseExpr);
}
