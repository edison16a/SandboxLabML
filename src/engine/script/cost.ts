import type { Block, Expr, Stmt } from './ast';
import type { CheckResult } from './check/context';
import { entriesByName } from './registry';
import { eachBlock } from './walk';

/**
 * Nanoseconds per cost unit, calibrated with a microbenchmark of the
 * controller alone: the Intermediate preset costs 20 units and adds about
 * 70 ns per car per tick on a laptop. Treat the result as a rough guide.
 */
export const NS_PER_UNIT = 3.5;

/** Above this the linter warns that the script may slow training noticeably. */
export const HIGH_COST = 400;

export function costToMicros(cost: number): number {
  return (cost * NS_PER_UNIT) / 1000;
}

/**
 * Abstract cost of one tick for one agent: the number of node evaluations,
 * with registry entries weighted by their cost hint. Branches count their
 * more expensive side, loops multiply by their typical length, and the
 * script's own sensors are included because they run every tick too.
 */
export function estimateCost(check: CheckResult): number {
  let cost = 0;
  for (const item of check.program.items) if (item.kind === 'sensor') cost += 3 + exprCost(check, item.value);
  const tick = eachBlock(check.program, 'tick');
  if (tick) cost += blockCost(check, tick);
  return cost;
}

export function exprCost(check: CheckResult, e: Expr): number {
  const info = check.exprs.get(e);
  if (info && info.value !== undefined) return 1;
  switch (e.kind) {
    case 'name': {
      const ref = info?.ref;
      if (ref?.kind === 'entry') return ref.entry.cost;
      return ref?.kind === 'item' ? 2 : 1;
    }
    case 'unary':
      return 1 + exprCost(check, e.operand);
    case 'binary':
      return 1 + exprCost(check, e.left) + exprCost(check, e.right);
    case 'call': {
      const call = check.calls.get(e);
      let cost = 1 + (call?.entry.cost ?? 1);
      for (const a of e.args) cost += exprCost(check, a.value);
      return cost;
    }
    case 'record':
      return e.fields.reduce((sum, f) => sum + exprCost(check, f.value), 0);
    default:
      return 1;
  }
}

export function blockCost(check: CheckResult, b: Block): number {
  return b.stmts.reduce((sum, s) => sum + stmtCost(check, s), 0);
}

function stmtCost(check: CheckResult, s: Stmt): number {
  switch (s.kind) {
    case 'let':
      return 1 + exprCost(check, s.value);
    case 'reward':
      return 1 + exprCost(check, s.value) + (s.when ? exprCost(check, s.when) : 0);
    case 'stop':
      return 1 + exprCost(check, s.when);
    case 'expr':
      return exprCost(check, s.expr);
    case 'if': {
      const other = s.else === null ? 0 : 'kind' in s.else ? stmtCost(check, s.else) : blockCost(check, s.else);
      return 1 + exprCost(check, s.cond) + Math.max(blockCost(check, s.then), other);
    }
    case 'repeat':
      return s.count * (1 + blockCost(check, s.body));
    case 'forEach': {
      const entry = entriesByName(check.env).get(s.collection);
      const size = entry?.binding.kind === 'collection' ? entry.binding.typicalSize : 8;
      return size * (2 + blockCost(check, s.body));
    }
  }
}
