import type { Span } from './diagnostics';
import type { UnitName } from './units';

/**
 * The syntax tree. Nodes are plain JSON-friendly objects with source spans.
 * Comments and blank lines are part of the tree, so printing and the block
 * view can round trip a script without losing what the author wrote.
 */

export interface Comment {
  /** Text after `//`, trimmed. */
  text: string;
  span: Span;
}

/** Comments and spacing around one line of code. */
export interface Trivia {
  /** Comment lines directly above. */
  leading: Comment[];
  /** Comment at the end of the same line (after the closing `}` for blocks). */
  trailing: Comment | null;
  /** A blank line separates this line from the one above. */
  blankBefore: boolean;
}

// Expressions

export interface NumberExpr {
  kind: 'number';
  /** The number as written, before units are applied (45 for `45 deg`, 20 for `20%`). */
  value: number;
  unit: UnitName;
  span: Span;
}

export interface StringExpr {
  kind: 'string';
  value: string;
  span: Span;
}

export interface BoolExpr {
  kind: 'bool';
  value: boolean;
  span: Span;
}

/** A name, possibly dotted: `car.speed` is one node with path ["car", "speed"]. */
export interface NameExpr {
  kind: 'name';
  path: string[];
  span: Span;
}

export type UnaryOp = '-' | '+' | 'not';

export interface UnaryExpr {
  kind: 'unary';
  op: UnaryOp;
  operand: Expr;
  span: Span;
}

export type BinaryOp = 'or' | 'and' | '<' | '>' | '<=' | '>=' | '==' | '!=' | '+' | '-' | '*' | '/' | '%';

export interface BinaryExpr {
  kind: 'binary';
  op: BinaryOp;
  left: Expr;
  right: Expr;
  span: Span;
  opSpan: Span;
}

/** A call or record argument. `name` is null for a positional argument such as `abs(x)`. */
export interface Arg {
  name: string | null;
  value: Expr;
  span: Span;
}

export interface CallExpr {
  kind: 'call';
  callee: Expr;
  args: Arg[];
  span: Span;
}

/** `{ weights: 0.8, addNode: 0.03 }`, only valid as an operator argument. */
export interface RecordExpr {
  kind: 'record';
  fields: Arg[];
  span: Span;
}

export type Expr = NumberExpr | StringExpr | BoolExpr | NameExpr | UnaryExpr | BinaryExpr | CallExpr | RecordExpr;

// Statements

export interface Block {
  stmts: Stmt[];
  /** Comment on the same line as the opening `{`. */
  openComment: Comment | null;
  /** Comments after the last statement, before the closing `}`. */
  dangling: Comment[];
  span: Span;
}

interface Base extends Trivia {
  span: Span;
}

export interface LetStmt extends Base {
  kind: 'let';
  name: string;
  nameSpan: Span;
  value: Expr;
}

export interface RewardStmt extends Base {
  kind: 'reward';
  value: Expr;
  when: Expr | null;
}

export interface StopStmt extends Base {
  kind: 'stop';
  reason: string;
  reasonSpan: Span;
  when: Expr;
}

export interface IfStmt extends Base {
  kind: 'if';
  cond: Expr;
  then: Block;
  /** An IfStmt here is an `else if` chain. */
  else: Block | IfStmt | null;
}

export interface RepeatStmt extends Base {
  kind: 'repeat';
  count: number;
  countSpan: Span;
  body: Block;
}

export interface ForEachStmt extends Base {
  kind: 'forEach';
  variable: string;
  variableSpan: Span;
  collection: string;
  collectionSpan: Span;
  body: Block;
}

/** A call on its own line, such as `drive(...)` or `keepChampions()`. */
export interface ExprStmt extends Base {
  kind: 'expr';
  expr: Expr;
}

export type Stmt = LetStmt | RewardStmt | StopStmt | IfStmt | RepeatStmt | ForEachStmt | ExprStmt;

// Top level

export interface SensorItem extends Base {
  kind: 'sensor';
  name: string;
  nameSpan: Span;
  label: string;
  lo: Expr;
  hi: Expr;
  value: Expr;
}

export type EventName = 'tick' | 'generation';

export interface EachItem extends Base {
  kind: 'each';
  event: EventName;
  body: Block;
}

export type Item = SensorItem | LetStmt | EachItem;

export interface Header extends Base {
  name: string;
  env: string;
  envSpan: Span;
  version: number;
}

export interface BrainDecl extends Base {
  id: string;
  idSpan: Span;
}

export interface Program {
  header: Header | null;
  brain: BrainDecl | null;
  items: Item[];
  /** Comments after everything else. */
  dangling: Comment[];
}

export function emptyTrivia(): Trivia {
  return { leading: [], trailing: null, blankBefore: false };
}
