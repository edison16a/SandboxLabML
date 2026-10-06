import type { BinaryExpr, Expr } from '../ast';
import type { CheckResult } from '../check/context';
import { formatNumber } from '../printExpr';
import type { RegistryEntry } from '../registry';
import { dimOf, type UnitName } from '../units';
import { walkStmts } from '../walk';
import type { Report } from './rewards';

const FLIP: Record<string, string> = { '<': '>', '>': '<', '<=': '>=', '>=': '<=', '==': '==', '!=': '!=' };

function rangedEntry(check: CheckResult, e: Expr): RegistryEntry | null {
  const ref = check.exprs.get(e)?.ref;
  return ref?.kind === 'entry' && ref.entry.range ? ref.entry : null;
}

/**
 * Whether a comparison between a sensor with a known range and a constant
 * can ever be true, such as `car.speed > 100 m/s` when the car tops out at
 * 35 m/s. Returns the sensor when it cannot.
 */
function impossible(check: CheckResult, e: BinaryExpr): RegistryEntry | null {
  const lv = check.exprs.get(e.left)?.value;
  const rv = check.exprs.get(e.right)?.value;
  let entry = rangedEntry(check, e.left);
  let k = typeof rv === 'number' ? rv : null;
  let op: string = e.op;
  if (!entry || k === null) {
    entry = rangedEntry(check, e.right);
    k = typeof lv === 'number' ? lv : null;
    op = FLIP[e.op] ?? e.op;
  }
  if (!entry?.range || k === null) return null;
  const [lo, hi] = entry.range;
  const never = (op === '>' && k >= hi) || (op === '>=' && k > hi) || (op === '<' && k <= lo) || (op === '<=' && k < lo) || (op === '==' && (k < lo || k > hi));
  return never ? entry : null;
}

function unitText(entry: RegistryEntry): string {
  const unit = entry.unit as UnitName;
  return dimOf(unit).some((x) => x !== 0) ? ` ${unit}` : '';
}

/** Stops whose condition is always false never fire, and always true ones end every episode at once. */
export function lintConditions(check: CheckResult, report: Report): void {
  for (const item of check.program.items) {
    if (item.kind !== 'each' || item.event !== 'tick') continue;
    walkStmts(item.body, (s) => {
      const cond = s.kind === 'stop' || s.kind === 'reward' ? s.when : null;
      if (!cond) return;
      const what = s.kind === 'stop' ? 'This stop can never fire' : 'This reward can never be given';
      const value = check.exprs.get(cond)?.value;
      if (value === false) return report('never-true', `${what}, because its condition is always false.`, cond.span);
      if (value === true && s.kind === 'stop') return report('always-true', 'This stop fires on the very first tick, because its condition is always true.', cond.span);
      if (cond.kind !== 'binary') return;
      const entry = impossible(check, cond);
      if (!entry?.range) return;
      const [lo, hi] = entry.range;
      report('never-true', `${what}: ${entry.name} stays between ${formatNumber(round(lo))} and ${formatNumber(round(hi))}${unitText(entry)}.`, cond.span);
    });
  }
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}
