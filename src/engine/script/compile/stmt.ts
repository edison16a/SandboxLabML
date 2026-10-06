import type { Block, CallExpr, Expr, Stmt } from '../ast';
import type { CallInfo } from '../check/context';
import { entriesByName } from '../registry';
import type { EffectArgs, Reader, Test } from '../registry/types';
import { compileBool, compileNum } from './expr';
import { constOf, infoOf, type Exec, type Frame } from './frame';
import { sequence } from './sequence';

const noop: Exec = () => false;

/** Compiles a block into one closure that runs its statements in order. */
export function compileBlock(f: Frame, b: Block): Exec {
  return sequence(b.stmts.map((s) => compileStmt(f, s)).filter((x): x is Exec => x !== null));
}

function compileStmt(f: Frame, s: Stmt): Exec | null {
  switch (s.kind) {
    case 'let': {
      const slots = f.slots;
      const i = f.check.slots.get(s) ?? 0;
      if (infoOf(f, s.value).type.kind === 'bool') {
        const t = compileBool(f, s.value);
        return (v, io) => {
          slots[i] = t(v, io) ? 1 : 0;
        };
      }
      const r = compileNum(f, s.value);
      return (v, io) => {
        slots[i] = r(v, io);
      };
    }
    case 'reward':
      return compileReward(f, s.value, s.when);
    case 'stop': {
      const t = compileBool(f, s.when);
      const reason = s.reason;
      return (v, io) => {
        if (!t(v, io)) return false;
        io.stop = reason;
        return true;
      };
    }
    case 'if': {
      const c = compileBool(f, s.cond);
      const then = compileBlock(f, s.then);
      if (s.else === null) return (v, io) => c(v, io) && then(v, io);
      const other = 'kind' in s.else ? (compileStmt(f, s.else) ?? noop) : compileBlock(f, s.else);
      return (v, io) => (c(v, io) ? then(v, io) : other(v, io));
    }
    case 'repeat': {
      const body = compileBlock(f, s.body);
      const n = s.count;
      return (v, io) => {
        for (let i = 0; i < n; i++) if (body(v, io)) return true;
        return false;
      };
    }
    case 'forEach':
      return compileForEach(f, s);
    case 'expr':
      return compileEffect(f, s.expr as CallExpr);
  }
}

/**
 * Rewards add to `io.reward`, specialized for constant amounts, missing
 * conditions and the common `constant * sensor` shape.
 */
function compileReward(f: Frame, value: Expr, when: Expr | null): Exec | null {
  const cond = when ? infoOf(f, when).value : true;
  if (cond === false) return null;
  const t: Test | null = when && cond !== true ? compileBool(f, when) : null;
  const k = infoOf(f, value).value;
  if (typeof k === 'number') {
    if (t) {
      return (v, io) => {
        if (t(v, io)) io.reward += k;
      };
    }
    return (_v, io) => {
      io.reward += k;
    };
  }
  const scaled = scaledReader(f, value);
  if (scaled && !t) {
    const [factor, r] = scaled;
    return (v, io) => {
      io.reward += factor * r(v, io);
    };
  }
  const r: Reader = compileNum(f, value);
  if (t) {
    return (v, io) => {
      if (t(v, io)) io.reward += r(v, io);
    };
  }
  return (v, io) => {
    io.reward += r(v, io);
  };
}

/** Splits `k * x` with a constant k into the constant and a reader for x. */
function scaledReader(f: Frame, e: Expr): [number, Reader] | null {
  if (e.kind !== 'binary' || e.op !== '*') return null;
  const lk = constOf(f, e.left);
  if (lk !== null) return [lk, compileNum(f, e.right)];
  return null;
}

function compileForEach(f: Frame, s: Stmt & { kind: 'forEach' }): Exec {
  const entry = entriesByName(f.check.env).get(s.collection);
  if (!entry || entry.binding.kind !== 'collection') throw new Error(`Internal error: ${s.collection} is not a list.`);
  const size = entry.binding.size(f.bind);
  const max = entry.binding.maxSize;
  const slots = f.slots;
  const slot = f.check.slots.get(s) ?? 0;
  const body = compileBlock(f, s.body);
  return (v, io) => {
    const n = Math.min(size(v, io), max);
    for (let i = 0; i < n; i++) {
      slots[slot] = i;
      if (body(v, io)) return true;
    }
    return false;
  };
}

/** An action or operator call. Its arguments are compiled once and captured by the effect closure. */
function compileEffect(f: Frame, e: CallExpr): Exec {
  const call: CallInfo | undefined = f.check.calls.get(e);
  if (!call || call.entry.binding.kind !== 'effect') throw new Error('Internal error: a statement call is not an action.');
  return call.entry.binding.apply(effectArgs(f, call), f.bind);
}

function effectArgs(f: Frame, call: CallInfo): EffectArgs {
  const num = new Map<string, Reader>();
  const bool = new Map<string, Test>();
  const str = new Map<string, string>();
  const rec = new Map<string, Map<string, Reader>>();
  const names = new Map<string, string>();
  for (const { param, expr } of call.args) {
    if (!expr) continue;
    if (expr.kind === 'name') names.set(param.name, expr.path.join('.'));
    if (param.type === 'number') num.set(param.name, compileNum(f, expr));
    else if (param.type === 'bool') bool.set(param.name, compileBool(f, expr));
    else if (param.type === 'string' && expr.kind === 'string') str.set(param.name, expr.value);
    else if (param.type === 'record' && expr.kind === 'record') {
      rec.set(param.name, new Map(expr.fields.map((field) => [field.name ?? '', compileNum(f, field.value)])));
    }
  }
  return { num, bool, str, rec, names };
}
