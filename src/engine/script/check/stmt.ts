import type { Block, Expr, ForEachStmt, LetStmt, Stmt } from '../ast';
import { suggest } from '../autocorrect/suggest';
import { replaceFix, type Span } from '../diagnostics';
import { RESERVED_ROOTS, inScope, scopeLabel } from '../registry';
import { ERROR } from '../types';
import { isUnitName } from '../units';
import { checkCall } from './call';
import type { CheckContext } from './context';
import { checkExpr, expectKind } from './expr';
import { entryType } from './names';

/** `repeat` needs a static bound so every script finishes. */
export const MAX_REPEAT = 64;

export function checkBlock(ctx: CheckContext, block: Block): void {
  ctx.pushFrame();
  for (const s of block.stmts) checkStmt(ctx, s);
  ctx.popFrame();
}

/**
 * Validates a name for a let, loop variable or sensor. Shadowing is not
 * allowed, and neither are registry roots like `car` or unit names like `s`,
 * because `5 s` and `car.speed` must keep their meaning.
 */
export function checkNewName(ctx: CheckContext, name: string, span: Span): boolean {
  let reason: string | null = null;
  if (RESERVED_ROOTS.has(name)) reason = `${name} is already a built-in name.`;
  else if (isUnitName(name) || name === 'brain' || name === 'tick') reason = `${name} has a special meaning in scripts.`;
  else if (ctx.isDefined(name)) reason = `${name} is already defined.`;
  if (reason) ctx.error('name-taken', `${reason} Pick another name.`, span);
  return reason === null;
}

function checkLet(ctx: CheckContext, s: LetStmt): void {
  const info = checkExpr(ctx, s.value);
  if (info.type.kind !== 'error' && info.type.kind !== 'number' && info.type.kind !== 'bool') {
    ctx.error('type', 'A let must hold a number or true or false.', s.value.span);
  }
  const fresh = checkNewName(ctx, s.name, s.nameSpan);
  const decl = ctx.declare(s.name, s.nameSpan, 'let');
  if (fresh) ctx.addLocal(s, s.name, decl, info.type);
}

function onlyInTick(ctx: CheckContext, word: string, span: Span): void {
  if (ctx.scope !== 'tick') ctx.error('wrong-scope', `${word} only works inside each tick.`, span);
}

function checkStmt(ctx: CheckContext, s: Stmt): void {
  switch (s.kind) {
    case 'let':
      return checkLet(ctx, s);
    case 'reward':
      onlyInTick(ctx, 'reward', s.span);
      expectKind(ctx, checkExpr(ctx, s.value), 'number', s.value.span, 'A reward');
      if (s.when) expectKind(ctx, checkExpr(ctx, s.when), 'bool', s.when.span, 'The condition after when');
      return;
    case 'stop':
      onlyInTick(ctx, 'stop', s.span);
      if (s.reason.trim() === '') ctx.error('empty-reason', 'Give the stop a reason, such as "crash".', s.reasonSpan);
      expectKind(ctx, checkExpr(ctx, s.when), 'bool', s.when.span, 'The condition after when');
      return;
    case 'if':
      expectKind(ctx, checkExpr(ctx, s.cond), 'bool', s.cond.span, 'The condition of if');
      checkBlock(ctx, s.then);
      if (s.else && 'kind' in s.else) checkStmt(ctx, s.else);
      else if (s.else) checkBlock(ctx, s.else);
      return;
    case 'repeat':
      if (!Number.isInteger(s.count) || s.count < 1 || s.count > MAX_REPEAT) {
        ctx.error('repeat-count', `repeat needs a whole number from 1 to ${MAX_REPEAT}.`, s.countSpan);
      }
      return checkBlock(ctx, s.body);
    case 'forEach':
      return checkForEach(ctx, s);
    case 'expr':
      return checkExprStmt(ctx, s.expr);
  }
}

function checkForEach(ctx: CheckContext, s: ForEachStmt): void {
  const entry = ctx.names.get(s.collection);
  const lists = [...ctx.names.values()].filter((e) => e.kind === 'collection');
  if (!entry || entry.kind !== 'collection') {
    const found = suggest(s.collection, lists.map((e) => e.name));
    const hint = found.length > 0 ? ` Did you mean ${found[0].name}?` : lists.length > 0 ? ` Try ${lists.map((e) => e.name).join(' or ')}.` : '';
    ctx.error('unknown-list', `There is no list called ${s.collection}.${hint}`, s.collectionSpan, found.map((f) => replaceFix(`Change to ${f.name}`, s.collectionSpan, f.name)));
  } else if (!inScope(entry, ctx.blockScope)) {
    ctx.error('wrong-scope', `${entry.name} only works inside ${scopeLabel(entry.scope)}.`, s.collectionSpan);
  }
  ctx.pushFrame();
  const fresh = checkNewName(ctx, s.variable, s.variableSpan);
  const decl = ctx.declare(s.variable, s.variableSpan, 'loop');
  const ok = entry?.kind === 'collection' && inScope(entry, ctx.blockScope);
  // A broken loop still declares its variable, as an error value, so the body does not report it again.
  if (fresh) ctx.addLocal(s, s.variable, decl, ok ? entryType(entry) : ERROR, ok ? entry : undefined);
  for (const inner of s.body.stmts) checkStmt(ctx, inner);
  ctx.popFrame();
}

function checkExprStmt(ctx: CheckContext, e: Expr): void {
  if (e.kind !== 'call') {
    checkExpr(ctx, e);
    ctx.error('no-effect', 'This line does nothing on its own. Use the value in reward, let, if or stop.', e.span);
    return;
  }
  const info = checkCall(ctx, e, true, checkExpr);
  ctx.exprs.set(e, info);
  const call = ctx.calls.get(e);
  if (call && call.entry.kind === 'function') {
    ctx.error('unused-result', `The result of ${call.entry.name} is not used. Use it in reward, let, if or stop.`, e.span);
  }
}
