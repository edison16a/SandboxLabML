import type { BrainDecl, Header, Program, SensorItem } from './ast';
import { PRESET_BLUEPRINTS, findPresetBlueprint } from '../blueprints/presets';
import { SCRIPT_API_VERSION } from '../core/version';
import type { EnvId } from '../env/types';
import { suggest } from './autocorrect/suggest';
import { CheckContext, type CheckResult } from './check/context';
import { checkExpr, expectKind } from './check/expr';
import { checkBlock, checkNewName } from './check/stmt';
import { unitsAgree } from './check/unitFix';
import { replaceFix, sortDiagnostics, type Span } from './diagnostics';
import { entriesByName, renamesFor, SCRIPT_ENVS } from './registry';
import { describeType } from './types';
import { dimWords, sameDim } from './units';

export type { CheckResult, ExprInfo, CallInfo, NameRef, ResolvedArg, Declaration } from './check/context';

export interface CheckOptions {
  /** Brain ids a script may name. Defaults to the preset blueprints. */
  blueprints?: readonly string[];
}

/**
 * Resolves every name against the registry for the script's environment,
 * checks kinds, units and scopes, and records what each expression is for
 * the compiler. Old names are rewritten in the tree. Never throws.
 */
export function check(program: Program, opts: CheckOptions = {}): CheckResult {
  const env = envOf(program.header);
  const ctx = new CheckContext(env, entriesByName(env), renamesFor(env));
  checkHeader(ctx, program.header);
  checkBrain(ctx, program.brain, env, opts.blueprints ?? PRESET_BLUEPRINTS.map((b) => b.id));

  // Constants first, in order, so both blocks can use any of them.
  for (const item of program.items) {
    if (item.kind !== 'let') continue;
    ctx.scope = 'top';
    const info = checkExpr(ctx, item.value);
    const fresh = checkNewName(ctx, item.name, item.nameSpan);
    const decl = ctx.declare(item.name, item.nameSpan, 'const');
    if (info.type.kind === 'error') continue;
    if (info.value === undefined) ctx.error('not-constant', 'A top-level let must be a constant. Move it into each tick or each generation.', item.value.span);
    else if (fresh) ctx.constants.set(item.name, { type: info.type, value: info.value, decl });
  }
  for (const item of program.items) if (item.kind === 'sensor') checkSensor(ctx, item);
  const seen = new Set<string>();
  for (const item of program.items) {
    if (item.kind !== 'each') continue;
    if (seen.has(item.event)) ctx.error('duplicate-block', `A script has one each ${item.event} block. Merge the two.`, { from: item.span.from, to: item.body.span.from });
    seen.add(item.event);
    ctx.scope = item.event;
    checkBlock(ctx, item.body);
  }
  ctx.scope = 'top';
  const result = ctx.result(program);
  result.diagnostics = sortDiagnostics(result.diagnostics);
  return result;
}

function envOf(h: Header | null): EnvId | null {
  return h && (SCRIPT_ENVS as readonly string[]).includes(h.env) ? (h.env as EnvId) : null;
}

function checkHeader(ctx: CheckContext, h: Header | null): void {
  if (!h) return;
  if (!(SCRIPT_ENVS as readonly string[]).includes(h.env)) {
    const found = suggest(h.env, SCRIPT_ENVS);
    const hint = found.length > 0 ? ` Did you mean ${found[0].name}?` : ` Use ${SCRIPT_ENVS.join(' or ')}.`;
    ctx.error('unknown-env', `There is no environment called ${h.env}.${hint}`, h.envSpan, found.map((f) => replaceFix(`Change to ${f.name}`, h.envSpan, f.name)));
  }
  if (h.version !== SCRIPT_API_VERSION) {
    const span: Span = { from: h.span.to - `v${h.version}`.length, to: h.span.to };
    ctx.error('unsupported-version', `This app runs version ${SCRIPT_API_VERSION} scripts.`, span, [replaceFix(`Change to v${SCRIPT_API_VERSION}`, span, `v${SCRIPT_API_VERSION}`)]);
  }
}

function checkBrain(ctx: CheckContext, b: BrainDecl | null, env: EnvId | null, allowed: readonly string[]): void {
  if (!b) return;
  if (!allowed.includes(b.id)) {
    const found = suggest(b.id, allowed);
    const hint = found.length > 0 ? ` Did you mean ${found[0].name}?` : '';
    ctx.error('unknown-brain', `There is no brain called ${b.id}.${hint}`, b.idSpan, found.map((f) => replaceFix(`Change to ${f.name}`, b.idSpan, f.name)));
    return;
  }
  const preset = findPresetBlueprint(b.id);
  if (preset && env && preset.env !== env) ctx.error('brain-env', `${b.id} is a ${preset.env} brain, but this script is for ${env}.`, b.idSpan);
}

/**
 * A script sensor adds one brain input: its value scaled into [0, 1] by a
 * constant range. The range ends must be constants in the value's unit.
 */
function checkSensor(ctx: CheckContext, s: SensorItem): void {
  ctx.scope = 'top';
  const lo = checkExpr(ctx, s.lo);
  const hi = checkExpr(ctx, s.hi);
  ctx.scope = 'sensor';
  const value = checkExpr(ctx, s.value);
  ctx.scope = 'top';
  if (checkNewName(ctx, s.name, s.nameSpan)) ctx.sensorNames.add(s.name);
  ctx.declare(s.name, s.nameSpan, 'sensor').used = true;
  if (value.type.kind === 'error' || lo.type.kind === 'error' || hi.type.kind === 'error') return;
  if (value.type.kind !== 'number' && value.type.kind !== 'bool') {
    ctx.error('type', `A sensor must measure a number or true or false, but this is ${describeType(value.type)}.`, s.value.span);
    return;
  }
  for (const [end, info] of [
    [s.lo, lo],
    [s.hi, hi],
  ] as const) {
    if (!expectKind(ctx, info, 'number', end.span, 'Each end of a sensor range')) return;
    if (typeof info.value !== 'number') {
      ctx.error('not-constant', 'The range of a sensor must be made of constants, like 0 m .. 60 m.', end.span);
      return;
    }
    const dim = value.type.kind === 'bool' ? info.type.dim : value.type.dim;
    if (!unitsAgree(info.type.dim, dim, end, end) && !sameDim(info.type.dim, dim)) {
      ctx.error('unit-mismatch', `The sensor measures ${dimWords(dim)}, but this end of the range is in ${dimWords(info.type.dim)}.`, end.span);
      return;
    }
  }
  if ((lo.value as number) >= (hi.value as number)) ctx.error('empty-range', 'The low end of the range must be below the high end.', { from: s.lo.span.from, to: s.hi.span.to });
}
