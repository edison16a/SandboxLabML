import type { EnvId } from '../env/types';
import type { Arg, Expr, Stmt } from './ast';
import { printExpr, quote } from './printExpr';
import { entriesByName, type RegistryEntry } from './registry';

const COMPARE: Record<string, string> = { '>': 'is above', '>=': 'is at least', '<': 'is below', '<=': 'is at most', '==': 'equals', '!=': 'is not' };
const ARITH: Record<string, string> = { '+': 'plus', '-': 'minus', '*': 'times', '/': 'divided by', '%': 'modulo' };

function lookup(env: EnvId | null, e: Expr): RegistryEntry | undefined {
  return e.kind === 'name' ? entriesByName(env).get(e.path.join('.')) : undefined;
}

/** Fills an entry's explain phrase with the explained arguments, by name or position. */
function fill(entry: RegistryEntry, args: Arg[], env: EnvId | null): string {
  return entry.explain.replace(/\{(\w+)\}/g, (_m, name: string) => {
    const index = entry.params.findIndex((p) => p.name === name);
    const arg = args.find((a) => a.name === name) ?? args.find((a, i) => a.name === null && i === index);
    if (arg) return explainExpr(arg.value, env);
    const def = entry.params[index]?.default;
    return def === undefined ? name : String(def);
  });
}

/** An expression in words, such as "the car's speed is above 3 m/s". Unknown names are kept as written. */
export function explainExpr(e: Expr, env: EnvId | null): string {
  switch (e.kind) {
    case 'number':
    case 'bool':
      return printExpr(e);
    case 'string':
      return quote(e.value);
    case 'name':
      return lookup(env, e)?.explain ?? e.path.join('.');
    case 'unary':
      if (e.op === 'not') return `it is not the case that ${explainExpr(e.operand, env)}`;
      return e.op === '-' && e.operand.kind !== 'number' ? `minus ${explainExpr(e.operand, env)}` : printExpr(e);
    case 'binary': {
      const l = explainExpr(e.left, env);
      const r = explainExpr(e.right, env);
      if (e.op === 'and' || e.op === 'or') return `${l} ${e.op} ${r}`;
      return `${l} ${COMPARE[e.op] ?? ARITH[e.op] ?? e.op} ${r}`;
    }
    case 'call': {
      const entry = lookup(env, e.callee);
      return entry ? fill(entry, e.args, env) : printExpr(e);
    }
    case 'record':
      return e.fields.map((f) => `${f.name} ${explainExpr(f.value, env)}`).join(', ');
  }
}

const capital = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/**
 * One statement in plain English for the Explain toggle, such as "Give +1
 * when the car passes a checkpoint". Nested blocks are explained by calling
 * this on each of their statements.
 */
export function explainStmt(s: Stmt, env: EnvId | null): string {
  switch (s.kind) {
    case 'reward':
      return `Give ${explainExpr(s.value, env)} ${s.when ? `when ${explainExpr(s.when, env)}` : 'every tick'}`;
    case 'stop':
      return `End the run as ${quote(s.reason)} when ${explainExpr(s.when, env)}`;
    case 'let':
      return `Call ${explainExpr(s.value, env)} ${s.name}`;
    case 'if':
      return `If ${explainExpr(s.cond, env)}`;
    case 'repeat':
      return `Repeat ${s.count} times`;
    case 'forEach': {
      const list = entriesByName(env).get(s.collection);
      return `For ${list?.explain ?? s.collection}, called ${s.variable}`;
    }
    case 'expr':
      return capital(explainExpr(s.expr, env));
  }
}
