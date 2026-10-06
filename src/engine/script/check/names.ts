import type { NameExpr } from '../ast';
import { suggest } from '../autocorrect/suggest';
import { insertFix, replaceFix, suggestionFixes, type QuickFix } from '../diagnostics';
import { findAnywhere, inScope, scopeLabel, type RegistryEntry } from '../registry';
import { BOOL, ERROR, num } from '../types';
import { dimOf, type UnitName } from '../units';
import type { CheckContext, ExprInfo } from './context';

export const ERROR_INFO: ExprInfo = { type: ERROR };

/** Names that only make sense in JavaScript. Scripts get a plain explanation instead of a bare "unknown name". */
const JS_WORDS = new Set(['window', 'document', 'globalThis', 'self', 'fetch', 'eval', 'Function', 'constructor', 'prototype', '__proto__', 'process', 'require', 'import', 'console', 'localStorage', 'alert', 'setTimeout', 'XMLHttpRequest', 'WebSocket', 'Worker', 'this']);

const CALLABLE = new Set(['function', 'action', 'operator']);

/** Unit of an entry's value. `*` and `sqrt` results are worked out per call by the call checker. */
export function entryType(e: RegistryEntry) {
  if (e.type === 'bool') return BOOL;
  const unit = e.unit === '*' || e.unit === 'sqrt' ? '' : e.unit;
  return num(dimOf(unit as UnitName));
}

/**
 * Finds a registry entry for a dotted name. Old names listed in
 * `renamedFrom` are rewritten in the tree with a warning and a fix, so old
 * scripts keep working and the editor can update their text.
 */
export function lookupEntry(ctx: CheckContext, node: NameExpr, callable: boolean): RegistryEntry | null {
  const full = node.path.join('.');
  let entry = ctx.names.get(full);
  if (!entry) {
    const renamed = ctx.renames.get(full);
    if (renamed) {
      ctx.report('warning', 'renamed', `${full} is now called ${renamed.name}.`, node.span, [replaceFix(`Change to ${renamed.name}`, node.span, renamed.name)]);
      node.path = renamed.name.split('.');
      entry = renamed;
    }
  }
  if (entry) return entry;
  const elsewhere = findAnywhere(full);
  if (elsewhere && elsewhere.env !== 'core') {
    ctx.error('wrong-env', `${full} only exists in ${elsewhere.env} scripts.`, node.span);
    return null;
  }
  unknownName(ctx, node, full, callable);
  return null;
}

function unknownName(ctx: CheckContext, node: NameExpr, full: string, callable: boolean): void {
  if (JS_WORDS.has(node.path[0])) {
    ctx.error('not-allowed', `Scripts cannot use ${node.path[0]}. They can only use the sensors, actions and functions listed in the docs.`, node.span);
    return;
  }
  const scope = ctx.blockScope;
  const candidates = [...ctx.names.values()].filter((e) => CALLABLE.has(e.kind) === callable && e.kind !== 'collection' && inScope(e, scope)).map((e) => e.name);
  if (!callable) candidates.push(...ctx.localNames());
  const found = suggest(full, candidates);
  const fixes: QuickFix[] = suggestionFixes(found, node.span);
  const hint = found.length > 0 ? ` Did you mean ${found.map((s) => s.name).join(' or ')}?` : '';
  if (callable) ctx.error('unknown-function', `There is no function or action called ${full}.${hint}`, node.span, fixes);
  else ctx.error('unknown-name', `Unknown name ${full}.${hint}`, node.span, fixes);
}

/** Whether an entry may be used where the checker is now. Reports why not. */
export function allowedHere(ctx: CheckContext, entry: RegistryEntry, node: NameExpr): boolean {
  if (ctx.scope === 'top') {
    const pure = entry.kind === 'constant' || (entry.binding.kind === 'fn' && entry.binding.fold !== undefined);
    if (!pure) {
      ctx.error('not-constant', `A top-level let must be a constant, so it cannot use ${entry.name}. Move it into each tick or each generation.`, node.span);
      return false;
    }
    return true;
  }
  const scope = ctx.blockScope;
  if (!inScope(entry, scope)) {
    ctx.error('wrong-scope', `${entry.name} only works inside ${scopeLabel(entry.scope)}.`, node.span);
    return false;
  }
  if (ctx.scope === 'sensor' && entry.notInSensor) {
    ctx.error('not-in-sensor', `A sensor cannot read ${entry.name}, because the brain runs after the sensors.`, node.span);
    return false;
  }
  for (const n of entry.needs ?? []) ctx.needs.add(n);
  if (entry.name === 'rand') ctx.usesRand[scope] = true;
  return true;
}

/** Resolves a name used as a value: a local, a loop item, a constant or a registry sensor. */
export function resolveName(ctx: CheckContext, node: NameExpr): ExprInfo {
  const [root, part] = node.path;
  if (node.path.length <= 2) {
    const local = ctx.lookupLocal(root);
    if (local) {
      if (node.path.length === 2) {
        ctx.error('no-part', `${root} has no part called ${part}.`, node.span);
        return ERROR_INFO;
      }
      if (local.collection) return { type: local.type, ref: { kind: 'item', slot: local.slot, collection: local.collection } };
      return { type: local.type, ref: { kind: 'slot', slot: local.slot } };
    }
    const constant = node.path.length === 1 ? ctx.lookupConstant(root) : undefined;
    if (constant) return { type: constant.type, value: constant.value };
  }
  const entry = lookupEntry(ctx, node, false);
  if (!entry || !allowedHere(ctx, entry, node)) return ERROR_INFO;
  switch (entry.kind) {
    case 'sensor':
      return { type: entryType(entry), ref: { kind: 'entry', entry } };
    case 'constant':
      return { type: entryType(entry), value: entry.binding.kind === 'const' ? entry.binding.value : 0, ref: { kind: 'entry', entry } };
    case 'function': {
      const fix = entry.params.length === 0 ? [insertFix('Add ()', node.span.to, '()')] : undefined;
      ctx.error('missing-call', `${entry.name} is a function. Call it with parentheses, like ${entry.name}(${entry.params.map((p) => `${p.name}: ...`).join(', ')}).`, node.span, fix);
      return ERROR_INFO;
    }
    case 'collection':
      ctx.error('misused-list', `${entry.name} is a list. Use it with for each, like for each item in ${entry.name} { ... }.`, node.span);
      return ERROR_INFO;
    default:
      ctx.error('misused-action', `${entry.name} is an action. Put it on its own line, like ${entry.example.split('\n')[0]}.`, node.span);
      return ERROR_INFO;
  }
}
