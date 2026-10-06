import type { BinaryExpr, CallExpr, Expr } from '../ast';
import type { NameRef } from '../check/context';
import type { Reader, Test } from '../registry/types';
import { compileCompare } from './compare';
import { constOf, infoOf, type Frame } from './frame';

/**
 * Builds a closure that computes a number. Constants were folded by the
 * checker and come back as a closure over the value. Common shapes such as
 * `0.01 * car.speed` get their own closure so the hot path makes one call
 * per node instead of two.
 */
export function compileNum(f: Frame, e: Expr): Reader {
  const info = infoOf(f, e);
  if (typeof info.value === 'number') {
    const k = info.value;
    return () => k;
  }
  if (info.type.kind === 'bool') {
    const t = compileBool(f, e);
    return (v, io) => (t(v, io) ? 1 : 0);
  }
  switch (e.kind) {
    case 'name':
      return readName(f, info.ref);
    case 'unary': {
      const a = compileNum(f, e.operand);
      return e.op === '-' ? (v, io) => -a(v, io) : a;
    }
    case 'binary':
      return arithmetic(f, e);
    case 'call':
      return callReader(f, e);
    default:
      throw new Error(`Internal error: a ${e.kind} cannot be compiled as a number.`);
  }
}

/** Builds a closure that tests a condition. */
export function compileBool(f: Frame, e: Expr): Test {
  const info = infoOf(f, e);
  if (typeof info.value === 'boolean') {
    const k = info.value;
    return () => k;
  }
  if (e.kind === 'name') {
    const ref = info.ref;
    if (ref?.kind === 'slot') {
      const slots = f.slots;
      const i = ref.slot;
      return () => slots[i] !== 0;
    }
    if (ref?.kind === 'entry' && ref.entry.binding.kind === 'bool') return ref.entry.binding.read(f.bind);
  }
  if (e.kind === 'unary' && e.op === 'not') {
    const a = compileBool(f, e.operand);
    return (v, io) => !a(v, io);
  }
  if (e.kind === 'binary') {
    if (e.op === 'and' || e.op === 'or') {
      const a = compileBool(f, e.left);
      const b = compileBool(f, e.right);
      return e.op === 'and' ? (v, io) => a(v, io) && b(v, io) : (v, io) => a(v, io) || b(v, io);
    }
    if (infoOf(f, e.left).type.kind === 'bool') {
      const a = compileBool(f, e.left);
      const b = compileBool(f, e.right);
      return e.op === '==' ? (v, io) => a(v, io) === b(v, io) : (v, io) => a(v, io) !== b(v, io);
    }
    return compileCompare(e.op, compileNum(f, e.left), compileNum(f, e.right), constOf(f, e.left), constOf(f, e.right));
  }
  throw new Error(`Internal error: a ${e.kind} cannot be compiled as a condition.`);
}

function readName(f: Frame, ref: NameRef | undefined): Reader {
  const slots = f.slots;
  if (ref?.kind === 'slot') {
    const i = ref.slot;
    return () => slots[i];
  }
  if (ref?.kind === 'item' && ref.collection.binding.kind === 'collection') {
    const item = ref.collection.binding.item(f.bind);
    const i = ref.slot;
    return (v) => item(v, slots[i]);
  }
  if (ref?.kind === 'entry') {
    const b = ref.entry.binding;
    if (b.kind === 'num') return b.read(f.bind);
    if (b.kind === 'const') {
      const k = b.value;
      return () => k;
    }
  }
  throw new Error('Internal error: a name was not resolved to a number.');
}

function arithmetic(f: Frame, e: BinaryExpr): Reader {
  const a = compileNum(f, e.left);
  const b = compileNum(f, e.right);
  const lk = constOf(f, e.left);
  const rk = constOf(f, e.right);
  switch (e.op) {
    case '+':
      if (rk !== null) return (v, io) => a(v, io) + rk;
      if (lk !== null) return (v, io) => lk + b(v, io);
      return (v, io) => a(v, io) + b(v, io);
    case '-':
      if (rk !== null) return (v, io) => a(v, io) - rk;
      if (lk !== null) return (v, io) => lk - b(v, io);
      return (v, io) => a(v, io) - b(v, io);
    case '*':
      if (lk !== null) return (v, io) => lk * b(v, io);
      if (rk !== null) return (v, io) => a(v, io) * rk;
      return (v, io) => a(v, io) * b(v, io);
    case '/':
      if (rk !== null) return (v, io) => a(v, io) / rk;
      return (v, io) => a(v, io) / b(v, io);
    case '%':
      return (v, io) => a(v, io) % b(v, io);
    default:
      throw new Error(`Internal error: ${e.op} is not arithmetic.`);
  }
}

function callReader(f: Frame, e: CallExpr): Reader {
  const call = f.check.calls.get(e);
  if (!call || call.entry.binding.kind !== 'fn') throw new Error('Internal error: a call was not resolved to a function.');
  const args = call.args.map((a) => {
    if (a.expr) return compileNum(f, a.expr);
    const k = Number(a.param.default ?? 0);
    return (() => k) as Reader;
  });
  return call.entry.binding.call(args, f.bind);
}
