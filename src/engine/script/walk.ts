import type { Block, Expr, IfStmt, Program, Stmt } from './ast';

/** Visits an expression and every expression inside it, parents first. */
export function walkExpr(e: Expr, visit: (e: Expr) => void): void {
  visit(e);
  switch (e.kind) {
    case 'unary':
      return walkExpr(e.operand, visit);
    case 'binary':
      walkExpr(e.left, visit);
      return walkExpr(e.right, visit);
    case 'call':
      walkExpr(e.callee, visit);
      for (const a of e.args) walkExpr(a.value, visit);
      return;
    case 'record':
      for (const f of e.fields) walkExpr(f.value, visit);
      return;
  }
}

/** The expressions that belong to a statement itself, not to its nested blocks. */
export function ownExprs(s: Stmt): Expr[] {
  switch (s.kind) {
    case 'let':
      return [s.value];
    case 'reward':
      return s.when ? [s.value, s.when] : [s.value];
    case 'stop':
      return [s.when];
    case 'if':
      return [s.cond];
    case 'expr':
      return [s.expr];
    default:
      return [];
  }
}

/** Blocks directly inside a statement. An `else if` contributes its own blocks. */
export function childBlocks(s: Stmt): Block[] {
  switch (s.kind) {
    case 'if':
      return [s.then, ...elseBlocks(s)];
    case 'repeat':
    case 'forEach':
      return [s.body];
    default:
      return [];
  }
}

function elseBlocks(s: IfStmt): Block[] {
  if (!s.else) return [];
  return 'kind' in s.else ? childBlocks(s.else) : [s.else];
}

/** Visits every statement in a block, including nested ones and `else if` branches. */
export function walkStmts(block: Block, visit: (s: Stmt) => void): void {
  for (const s of block.stmts) walkStmt(s, visit);
}

function walkStmt(s: Stmt, visit: (s: Stmt) => void): void {
  visit(s);
  if (s.kind === 'if' && s.else && 'kind' in s.else) {
    walkStmts(s.then, visit);
    walkStmt(s.else, visit);
    return;
  }
  for (const b of childBlocks(s)) walkStmts(b, visit);
}

/** Every expression in a block, nested statements included. */
export function walkBlockExprs(block: Block, visit: (e: Expr) => void): void {
  walkStmts(block, (s) => {
    for (const e of ownExprs(s)) walkExpr(e, visit);
  });
}

/** Root names an expression reads, such as "gap" in `gap * 2` or "car" in `car.speed`. */
export function rootNames(e: Expr): Set<string> {
  const out = new Set<string>();
  walkExpr(e, (x) => {
    if (x.kind === 'name') out.add(x.path[0]);
  });
  return out;
}

export function eachBlock(program: Program, event: 'tick' | 'generation'): Block | null {
  for (const item of program.items) if (item.kind === 'each' && item.event === event) return item.body;
  return null;
}
