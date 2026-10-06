import type { BinaryExpr, Expr, NumberExpr } from '../ast';
import { replaceFix, type QuickFix } from '../diagnostics';
import { formatNumber, formatUnit } from '../printExpr';
import { dimWords, literalUnitFor, sameDim, type Dim, type UnitName } from '../units';
import type { CheckContext } from './context';

/** The number literal inside `5`, `5 s` or `-5 s`, if that is what the expression is. */
export function literalOf(e: Expr): NumberExpr | null {
  if (e.kind === 'number') return e;
  if (e.kind === 'unary' && e.op !== 'not' && e.operand.kind === 'number') return e.operand;
  return null;
}

/** A bare `0` fits any unit: "speed above zero" needs no unit to make sense. */
export function isZeroLiteral(e: Expr): boolean {
  const lit = literalOf(e);
  return lit !== null && lit.value === 0 && (lit.unit === '' || lit.unit === '%');
}

/** True when both sides agree, or one of them is a bare zero. */
export function unitsAgree(a: Dim, b: Dim, left: Expr, right: Expr): boolean {
  return sameDim(a, b) || isZeroLiteral(left) || isZeroLiteral(right);
}

/**
 * A fix that rewrites a literal in the unit the other side expects, such as
 * `5` to `5 s`. Angles above one turn are offered in degrees, since nobody
 * means 30 radians.
 */
export function literalFix(side: Expr, target: Dim): { text: string; fix: QuickFix } | null {
  const lit = literalOf(side);
  if (!lit) return null;
  let unit: UnitName | null = literalUnitFor(target);
  if (unit === null) return null;
  if (unit === 'rad' && Math.abs(lit.value) > 2 * Math.PI) unit = 'deg';
  const text = formatNumber(lit.value) + formatUnit(unit);
  return { text, fix: replaceFix(`Change to ${text}`, lit.span, text) };
}

function verb(e: BinaryExpr, lt: Dim, rt: Dim): string {
  const l = dimWords(lt);
  const r = dimWords(rt);
  switch (e.op) {
    case '+':
      return `Adding ${l} to ${r}`;
    case '-':
      return `Subtracting ${r} from ${l}`;
    case '%':
      return `Taking the remainder of ${l} by ${r}`;
    default:
      return `Comparing ${l} to ${r}`;
  }
}

/** Reports `+`, `-`, `%` or a comparison whose sides have different units, with a fix when one side is a literal. */
export function reportUnitMismatch(ctx: CheckContext, e: BinaryExpr, lt: Dim, rt: Dim): void {
  const offer = literalFix(e.right, lt) ?? literalFix(e.left, rt);
  const message = offer ? `${verb(e, lt, rt)}. Did you mean ${offer.text}?` : `${verb(e, lt, rt)}. Both sides need the same unit.`;
  ctx.error('unit-mismatch', message, e.span, offer ? [offer.fix] : undefined);
}
