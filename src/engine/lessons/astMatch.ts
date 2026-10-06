import type { Expr, Program, Stmt } from '../script/ast';
import { check, type CheckResult } from '../script/checker';
import { childBlocks, ownExprs, walkExpr, walkStmts } from '../script/walk';
import type { AstPattern } from './types';

/** A statement or top-level item, flattened with the scope it lives in and what it mentions. */
interface Candidate {
  stmt: AstPattern['stmt'] | 'other';
  scope: 'tick' | 'generation' | 'top';
  /** Callee of a call statement, null for everything else. */
  callee: string | null;
  /** Every name and called function inside, including nested blocks for if and loops. */
  names: Set<string>;
}

/**
 * Names an expression mentions. Registry entries are recorded under their
 * current name, so an old alias in the script still matches, and plain
 * dotted paths are added too so patterns can name the learner's own lets.
 */
function collectNames(result: CheckResult, e: Expr, into: Set<string>): void {
  walkExpr(e, (x) => {
    if (x.kind === 'name') {
      into.add(x.path.join('.'));
      const ref = result.exprs.get(x)?.ref;
      if (ref?.kind === 'entry') into.add(ref.entry.name);
    } else if (x.kind === 'call') {
      const entry = result.calls.get(x)?.entry;
      if (entry) into.add(entry.name);
    }
  });
}

function stmtKind(s: Stmt): Candidate['stmt'] {
  if (s.kind === 'expr') return s.expr.kind === 'call' ? 'call' : 'other';
  if (s.kind === 'reward' || s.kind === 'stop' || s.kind === 'let' || s.kind === 'if') return s.kind;
  return 'other';
}

function fromStmt(result: CheckResult, s: Stmt, scope: 'tick' | 'generation'): Candidate {
  const names = new Set<string>();
  for (const e of ownExprs(s)) collectNames(result, e, names);
  for (const b of childBlocks(s)) walkStmts(b, (inner) => ownExprs(inner).forEach((e) => collectNames(result, e, names)));
  const callee = s.kind === 'expr' && s.expr.kind === 'call' ? (result.calls.get(s.expr)?.entry.name ?? null) : null;
  return { stmt: stmtKind(s), scope, callee, names };
}

/** Every statement of a program as a flat candidate list, top-level items included. */
function candidates(program: Program, result: CheckResult): Candidate[] {
  const out: Candidate[] = [];
  for (const item of program.items) {
    if (item.kind === 'each') {
      walkStmts(item.body, (s) => out.push(fromStmt(result, s, item.event)));
      continue;
    }
    const names = new Set<string>();
    if (item.kind === 'sensor') [item.lo, item.hi, item.value].forEach((e) => collectNames(result, e, names));
    else collectNames(result, item.value, names);
    out.push({ stmt: item.kind, scope: 'top', callee: null, names });
  }
  return out;
}

/**
 * Whether one candidate satisfies a pattern. `callee` means "is a call to"
 * for call statements and "contains a call to" for anything else, so a
 * pattern can ask for an if that switches tracks.
 */
function matchesOne(c: Candidate, p: AstPattern): boolean {
  if (c.stmt !== p.stmt) return false;
  if (p.scope && c.scope !== p.scope) return false;
  if (p.callee && c.callee !== p.callee && !(c.stmt !== 'call' && c.names.has(p.callee))) return false;
  return (p.uses ?? []).every((name) => c.names.has(name));
}

/** Checks a parsed program once and tests several patterns against it, true if any matches. */
export function matchesAny(program: Program, patterns: readonly AstPattern[]): boolean {
  const result = check(program);
  const all = candidates(program, result);
  return patterns.some((p) => all.some((c) => matchesOne(c, p)));
}
