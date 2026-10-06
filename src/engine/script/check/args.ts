import type { Arg, Expr } from '../ast';
import { suggest } from '../autocorrect/suggest';
import { replaceFix } from '../diagnostics';
import { formatNumber, quote } from '../printExpr';
import type { ParamDef } from '../registry';
import { describeType, RECORD, STRING } from '../types';
import { dimOf, dimWords, sameDim, type Dim, type UnitName } from '../units';
import type { CheckContext, ExprInfo } from './context';
import { ERROR_INFO } from './names';
import { isZeroLiteral, literalFix } from './unitFix';

export type CheckExpr = (ctx: CheckContext, e: Expr) => ExprInfo;

/** Shared unit of the `*` parameters in one call, filled by the first one seen. */
export interface StarUnit {
  dim: Dim | null;
}

export function fail(ctx: CheckContext, code: string, message: string, arg: Arg): false {
  ctx.error(code, message, arg.span);
  return false;
}

/** Checks one argument against its parameter: kind, unit (with a literal fix) and constant range. */
export function checkArg(ctx: CheckContext, p: ParamDef, value: Expr, star: StarUnit, checkExpr: CheckExpr): ExprInfo {
  if (p.type === 'string') return checkTextArg(ctx, p, value);
  if (p.type === 'record') return checkRecordArg(ctx, p, value, star, checkExpr);
  const info = checkExpr(ctx, value);
  if (info.type.kind === 'error') return info;
  if (info.type.kind !== p.type) {
    ctx.error('type', `${p.name} must be ${p.type === 'bool' ? 'true or false' : 'a number'}, but this is ${describeType(info.type)}.`, value.span);
    return ERROR_INFO;
  }
  if (p.type === 'bool') return info;
  let target: Dim;
  if (p.unit === '*') {
    if (star.dim === null && !isZeroLiteral(value)) star.dim = info.type.dim;
    target = star.dim ?? info.type.dim;
  } else {
    target = dimOf(p.unit as UnitName);
  }
  if (!sameDim(info.type.dim, target) && !isZeroLiteral(value)) {
    const offer = literalFix(value, target);
    const hint = offer ? ` Did you mean ${offer.text}?` : '';
    ctx.error('unit-mismatch', `${p.name} is in ${dimWords(target)}, but this is ${dimWords(info.type.dim)}.${hint}`, value.span, offer ? [offer.fix] : undefined);
    return ERROR_INFO;
  }
  if (typeof info.value === 'number' && p.range && (info.value < p.range[0] || info.value > p.range[1])) {
    ctx.report('warning', 'out-of-range', `${p.name} should be between ${formatNumber(p.range[0])} and ${formatNumber(p.range[1])}. It will be clamped.`, value.span);
  }
  return info;
}

function checkTextArg(ctx: CheckContext, p: ParamDef, value: Expr): ExprInfo {
  if (value.kind !== 'string') {
    ctx.error('type', `${p.name} must be text in quotes, like ${quote(String(p.choices?.[0] ?? 'name'))}.`, value.span);
    return ERROR_INFO;
  }
  ctx.exprs.set(value, { type: STRING });
  if (p.choices && !p.choices.includes(value.value)) {
    const found = suggest(value.value, p.choices);
    const fixes = found.map((s) => replaceFix(`Change to ${quote(s.name)}`, value.span, quote(s.name)));
    const hint = found.length > 0 ? ` Did you mean ${quote(found[0].name)}?` : ` Choose one of ${p.choices.join(', ')}.`;
    ctx.error('unknown-choice', `There is no ${p.name} ${quote(value.value)}.${hint}`, value.span, fixes);
    return ERROR_INFO;
  }
  return { type: STRING };
}

function checkRecordArg(ctx: CheckContext, p: ParamDef, value: Expr, star: StarUnit, checkExpr: CheckExpr): ExprInfo {
  if (value.kind !== 'record') {
    ctx.error('type', `${p.name} must be settings in { }, like { ${p.fields?.[0]?.name ?? 'name'}: 0.5 }.`, value.span);
    return ERROR_INFO;
  }
  ctx.exprs.set(value, { type: RECORD });
  const fields = p.fields ?? [];
  const seen = new Set<string>();
  let ok = true;
  for (const f of value.fields) {
    const def = fields.find((d) => d.name === f.name);
    const nameSpan = { from: f.span.from, to: f.span.from + (f.name ?? '').length };
    if (!def || f.name === null) {
      const found = suggest(f.name ?? '', fields.map((d) => d.name));
      const hint = found.length > 0 ? ` Did you mean ${found[0].name}?` : ` Use ${fields.map((d) => d.name).join(', ')}.`;
      ctx.error('unknown-field', `${p.name} has no setting called ${f.name}.${hint}`, nameSpan, found.map((s) => replaceFix(`Change to ${s.name}`, nameSpan, s.name)));
      ok = false;
    } else if (seen.has(def.name)) {
      ok = fail(ctx, 'duplicate-arg', `${def.name} is given twice.`, f);
    } else {
      seen.add(def.name);
      ok = checkArg(ctx, def, f.value, star, checkExpr).type.kind !== 'error' && ok;
    }
  }
  return ok ? { type: RECORD } : ERROR_INFO;
}
