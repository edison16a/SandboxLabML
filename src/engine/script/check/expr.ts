import type { BinaryExpr, Expr, UnaryExpr } from '../ast';
import type { Span } from '../diagnostics';
import { BOOL, describeType, ERROR, num, type ValueType } from '../types';
import { divDim, dimOf, mulDim, toBase } from '../units';
import { checkCall } from './call';
import type { CheckContext, ExprInfo } from './context';
import { ERROR_INFO, resolveName } from './names';
import { isZeroLiteral, reportUnitMismatch, unitsAgree } from './unitFix';

/** Checks an expression, records what it is for the compiler, and returns its type and constant value. */
export function checkExpr(ctx: CheckContext, e: Expr): ExprInfo {
  const info = inner(ctx, e);
  ctx.exprs.set(e, info);
  return info;
}

function inner(ctx: CheckContext, e: Expr): ExprInfo {
  switch (e.kind) {
    case 'number':
      return { type: num(dimOf(e.unit)), value: toBase(e.value, e.unit) };
    case 'bool':
      return { type: BOOL, value: e.value };
    case 'string':
      ctx.error('misplaced-text', 'Text in quotes can only be a name, such as a stop reason or a track id.', e.span);
      return ERROR_INFO;
    case 'record':
      ctx.error('misplaced-record', 'Settings in { } only work as an argument, such as mutate: { weights: 0.8 }.', e.span);
      return ERROR_INFO;
    case 'name':
      return resolveName(ctx, e);
    case 'call':
      return checkCall(ctx, e, false, checkExpr);
    case 'unary':
      return checkUnary(ctx, e);
    case 'binary':
      return checkBinary(ctx, e);
  }
}

/** Reports a value of the wrong kind. Already broken values stay quiet so one mistake gives one message. */
export function expectKind(ctx: CheckContext, info: ExprInfo, kind: 'number' | 'bool', span: Span, what: string): boolean {
  if (info.type.kind === 'error') return false;
  if (info.type.kind === kind) return true;
  const wanted = kind === 'bool' ? 'true or false' : 'a number';
  ctx.error('type', `${what} must be ${wanted}, but this is ${describeType(info.type)}.`, span);
  return false;
}

function checkUnary(ctx: CheckContext, e: UnaryExpr): ExprInfo {
  const a = checkExpr(ctx, e.operand);
  if (e.op === 'not') {
    if (!expectKind(ctx, a, 'bool', e.operand.span, 'The part after not')) return ERROR_INFO;
    return typeof a.value === 'boolean' ? { type: BOOL, value: !a.value } : { type: BOOL };
  }
  if (!expectKind(ctx, a, 'number', e.operand.span, `The part after ${e.op}`)) return ERROR_INFO;
  if (typeof a.value !== 'number') return { type: a.type };
  return { type: a.type, value: e.op === '-' ? -a.value : a.value };
}

const COMPARE = new Set(['<', '>', '<=', '>=', '==', '!=']);

function checkBinary(ctx: CheckContext, e: BinaryExpr): ExprInfo {
  const a = checkExpr(ctx, e.left);
  const b = checkExpr(ctx, e.right);
  if (a.type.kind === 'error' || b.type.kind === 'error') return ERROR_INFO;
  if (e.op === 'and' || e.op === 'or') {
    const ok = expectKind(ctx, a, 'bool', e.left.span, `Each side of ${e.op}`) && expectKind(ctx, b, 'bool', e.right.span, `Each side of ${e.op}`);
    if (!ok) return ERROR_INFO;
    return withValue(BOOL, a.value, b.value, (x, y) => (e.op === 'and' ? x && y : x || y));
  }
  if ((e.op === '==' || e.op === '!=') && a.type.kind === 'bool' && b.type.kind === 'bool') {
    return withValue(BOOL, a.value, b.value, (x, y) => (e.op === '==') === (x === y));
  }
  const ok = expectKind(ctx, a, 'number', e.left.span, `Each side of ${e.op}`) && expectKind(ctx, b, 'number', e.right.span, `Each side of ${e.op}`);
  if (!ok) return ERROR_INFO;
  if (COMPARE.has(e.op) || e.op === '+' || e.op === '-' || e.op === '%') {
    if (!unitsAgree(a.type.dim, b.type.dim, e.left, e.right)) {
      reportUnitMismatch(ctx, e, a.type.dim, b.type.dim);
      return ERROR_INFO;
    }
  }
  if (COMPARE.has(e.op)) return withValue(BOOL, a.value, b.value, (x, y) => compare(e.op, x as number, y as number));
  if ((e.op === '/' || e.op === '%') && b.value === 0) {
    ctx.error('divide-by-zero', 'Dividing by zero has no answer.', e.right.span);
    return ERROR_INFO;
  }
  let type: ValueType;
  if (e.op === '*') type = num(mulDim(a.type.dim, b.type.dim));
  else if (e.op === '/') type = num(divDim(a.type.dim, b.type.dim));
  else type = isZeroLiteral(e.left) ? b.type : a.type;
  const info = withValue(type, a.value, b.value, (x, y) => arith(e.op, x as number, y as number));
  if (typeof info.value === 'number' && !Number.isFinite(info.value)) {
    ctx.error('too-large', 'This works out to a number too large to use.', e.span);
    return { type: ERROR };
  }
  return info;
}

/** Folds two constant operands, or returns the type alone when either side is only known at run time. */
function withValue(type: ValueType, x: unknown, y: unknown, f: (x: number | boolean, y: number | boolean) => number | boolean): ExprInfo {
  if ((typeof x === 'number' || typeof x === 'boolean') && (typeof y === 'number' || typeof y === 'boolean')) return { type, value: f(x, y) };
  return { type };
}

export function compare(op: string, x: number, y: number): boolean {
  switch (op) {
    case '<':
      return x < y;
    case '>':
      return x > y;
    case '<=':
      return x <= y;
    case '>=':
      return x >= y;
    case '==':
      return x === y;
    default:
      return x !== y;
  }
}

export function arith(op: string, x: number, y: number): number {
  switch (op) {
    case '+':
      return x + y;
    case '-':
      return x - y;
    case '*':
      return x * y;
    case '/':
      return x / y;
    default:
      return x % y;
  }
}
