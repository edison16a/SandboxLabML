import { hashObject, hashString } from '../../core/hash';
import type { Block, IfStmt, Program, Stmt } from '../ast';
import type { CheckResult } from '../check/context';
import { print, printExpr, printStmt } from '../printer';
import { eachBlock, ownExprs, rootNames, walkStmts } from '../walk';

/** Hash of the program printed without comments or blank lines, so editing a comment never changes it. */
export function sourceHash(program: Program): string {
  return hashString(print(program, { comments: false }));
}

/**
 * Hash of everything that changes the genome shape or what a car does:
 * the environment, the brain, the script sensors (but not their labels)
 * and the part of each tick that decides actions. Rewards and stop rules
 * are left out, because they change which brains win, not how a stored
 * brain drives.
 */
export function forkHash(check: CheckResult): string {
  const program = check.program;
  const sensors = program.items.flatMap((i) => (i.kind === 'sensor' ? [`${i.name} ${printExpr(i.lo)} ${printExpr(i.hi)} ${printExpr(i.value)}`] : []));
  const tick = eachBlock(program, 'tick');
  const kept = tick ? actionSlice(check, tick) : [];
  const names = new Set<string>();
  for (const i of program.items) if (i.kind === 'sensor') rootNames(i.value).forEach((n) => names.add(n));
  collectNames({ stmts: kept, openComment: null, dangling: [], span: { from: 0, to: 0 } }, names);
  const constants = program.items.flatMap((i) => (i.kind === 'let' && names.has(i.name) ? [`${i.name}=${String(check.exprs.get(i.value)?.value)}`] : []));
  return hashObject({
    env: check.env,
    brain: program.brain?.id ?? null,
    sensors,
    actions: kept.map((s) => printStmt(s, 0, { comments: false })),
    constants,
  });
}

function collectNames(block: Block, into: Set<string>): void {
  walkStmts(block, (s) => {
    for (const e of ownExprs(s)) rootNames(e).forEach((n) => into.add(n));
  });
}

/**
 * The statements of a tick block that can affect an action: action calls,
 * the ifs and loops around them, and the lets they read, found by repeating
 * until the set of needed names stops growing.
 */
export function actionSlice(check: CheckResult, block: Block): Stmt[] {
  let needed = new Set<string>();
  for (let round = 0; round < 64; round++) {
    const kept = keep(check, block.stmts, needed);
    const names = new Set(needed);
    collectNames({ ...block, stmts: kept }, names);
    if (names.size === needed.size) return kept;
    needed = names;
  }
  return keep(check, block.stmts, needed);
}

function keep(check: CheckResult, stmts: Stmt[], needed: Set<string>): Stmt[] {
  const out: Stmt[] = [];
  for (const s of stmts) {
    const k = keepOne(check, s, needed);
    if (k) out.push(k);
  }
  return out;
}

function keepOne(check: CheckResult, s: Stmt, needed: Set<string>): Stmt | null {
  switch (s.kind) {
    case 'expr':
      return s.expr.kind === 'call' && check.calls.get(s.expr)?.entry.kind === 'action' ? s : null;
    case 'let':
      return needed.has(s.name) ? s : null;
    case 'if': {
      const then = keep(check, s.then.stmts, needed);
      let other: IfStmt | Block | null = null;
      if (s.else && 'kind' in s.else) other = keepOne(check, s.else, needed) as IfStmt | null;
      else if (s.else) other = { ...s.else, stmts: keep(check, s.else.stmts, needed) };
      const otherEmpty = other === null || ('stmts' in other && other.stmts.length === 0);
      if (then.length === 0 && otherEmpty) return null;
      return { ...s, then: { ...s.then, stmts: then }, else: other };
    }
    case 'repeat':
    case 'forEach': {
      const body = keep(check, s.body.stmts, needed);
      return body.length > 0 ? { ...s, body: { ...s.body, stmts: body } } : null;
    }
    default:
      return null;
  }
}
