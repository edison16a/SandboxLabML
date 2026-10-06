import type { Arg, CallExpr, NameExpr } from '../ast';
import { suggest } from '../autocorrect/suggest';
import { insertFix, replaceFix, type QuickFix, suggestionFixes } from '../diagnostics';
import { formatNumber, quote } from '../printExpr';
import type { ParamDef, RegistryEntry } from '../registry';
import { ERROR, num, VOID, type ValueType } from '../types';
import { dimOf, dimWords, sqrtDim } from '../units';
import { checkArg, fail, type CheckExpr, type StarUnit } from './args';
import type { CheckContext, ExprInfo, ResolvedArg } from './context';
import { allowedHere, ERROR_INFO, lookupEntry } from './names';

/**
 * Checks a call: the callee must be a registry function, action or
 * operator usable here, arguments are matched to parameters by position or
 * name, and every argument is checked for kind, unit and range.
 * `checkExpr` is passed in so this file and expr.ts do not import each other.
 */
export function checkCall(ctx: CheckContext, e: CallExpr, statement: boolean, checkExpr: CheckExpr): ExprInfo {
  if (e.callee.kind !== 'name') {
    checkExpr(ctx, e.callee);
    ctx.error('bad-call', 'Only named functions can be called, like abs(x) or drive(...).', e.span);
    return ERROR_INFO;
  }
  const callee = e.callee;
  const name = callee.path.join('.');
  if (callee.path.length === 1 && ctx.isDefined(name)) {
    ctx.error('not-callable', `${name} is a value, not a function.`, callee.span);
    return ERROR_INFO;
  }
  const entry = lookupEntry(ctx, callee, true);
  if (!entry) return ERROR_INFO;
  if (entry.kind === 'sensor' || entry.kind === 'constant' || entry.kind === 'collection') {
    const fix = e.args.length === 0 ? [replaceFix('Remove the ()', e.span, entry.name)] : undefined;
    ctx.error('not-callable', `${entry.name} is not a function. Use it without parentheses.`, e.span, fix);
    return ERROR_INFO;
  }
  if (!allowedHere(ctx, entry, callee)) return ERROR_INFO;
  if (!statement && entry.kind !== 'function') {
    ctx.error('misused-action', `${entry.name} is an action. Put it on its own line.`, e.span);
    return ERROR_INFO;
  }
  // Arguments are checked even when matching failed, so a typo inside them is still reported.
  const { args, ok: matched } = matchArgs(ctx, e, entry, callee);
  const star: StarUnit = { dim: null };
  let ok = matched;
  const values: number[] = [];
  for (const a of args) {
    if (!a.expr) continue;
    const info = checkArg(ctx, a.param, a.expr, star, checkExpr);
    ok = info.type.kind !== 'error' && ok;
    if (typeof info.value === 'number') values.push(info.value);
  }
  if (!ok) return ERROR_INFO;
  ctx.calls.set(e, { entry, args });
  const type = resultType(ctx, entry, star, e);
  const fold = entry.binding.kind === 'fn' ? entry.binding.fold : undefined;
  if (fold && values.length === args.length && type.kind === 'number') return { type, value: fold(values) };
  return { type };
}

function resultType(ctx: CheckContext, entry: RegistryEntry, star: StarUnit, e: CallExpr): ValueType {
  if (entry.type === 'void') return VOID;
  if (entry.type === 'bool') return { kind: 'bool', dim: [0, 0, 0] };
  if (entry.unit === '*') return num(star.dim ?? [0, 0, 0]);
  if (entry.unit === 'sqrt') {
    const d = sqrtDim(star.dim ?? [0, 0, 0]);
    if (d) return num(d);
    ctx.error('bad-unit', `The square root of ${dimWords(star.dim ?? [0, 0, 0])} has no simple unit.`, e.span);
    return ERROR;
  }
  return num(dimOf(entry.unit));
}

function matchArgs(ctx: CheckContext, e: CallExpr, entry: RegistryEntry, callee: NameExpr): { args: ResolvedArg[]; ok: boolean } {
  const given = new Map<ParamDef, Arg>();
  let named = false;
  let ok = true;
  e.args.forEach((arg, i) => {
    if (arg.name === null) {
      const p = entry.params[i];
      if (named) ok = fail(ctx, 'positional-after-named', 'Put values without a name before the named ones.', arg);
      else if (!p) ok = fail(ctx, 'too-many-args', `${entry.name} takes ${entry.params.length} value${entry.params.length === 1 ? '' : 's'}.`, arg);
      else given.set(p, arg);
      return;
    }
    named = true;
    const p = entry.params.find((q) => q.name === arg.name);
    if (!p) {
      const nameSpan = { from: arg.span.from, to: arg.span.from + arg.name.length };
      const found = suggest(arg.name, entry.params.map((q) => q.name));
      const fixes = suggestionFixes(found, nameSpan);
      const hint = found.length > 0 ? ` Did you mean ${found[0].name}?` : '';
      ctx.error('unknown-param', `${entry.name} has no setting called ${arg.name}.${hint}`, nameSpan, fixes);
      ok = false;
    } else if (given.has(p)) {
      ok = fail(ctx, 'duplicate-arg', `${p.name} is given twice.`, arg);
    } else {
      given.set(p, arg);
    }
  });
  for (const p of entry.params) {
    if (given.has(p) || !p.required) continue;
    const sep = e.args.length > 0 ? ', ' : '';
    const fix: QuickFix = insertFix(`Add ${p.name}`, e.span.to - 1, `${sep}${p.name}: ${placeholder(p)}`);
    ctx.error('missing-arg', `${callee.path.join('.')} needs ${p.name}. ${p.summary}`, e.span, [fix]);
    ok = false;
  }
  return { args: entry.params.map((param) => ({ param, expr: given.get(param)?.value ?? null })), ok };
}

/** A starting value for a missing argument: its default, or zero in its unit. */
function placeholder(p: ParamDef): string {
  if (p.type === 'string') return quote(String(p.choices?.[0] ?? p.default ?? ''));
  if (p.type === 'bool') return String(p.default ?? true);
  if (p.type === 'record') return '{}';
  const unit = p.unit === '*' || p.unit === '' ? '' : ` ${p.unit}`;
  return `${formatNumber(Number(p.default ?? 0))}${unit}`;
}
