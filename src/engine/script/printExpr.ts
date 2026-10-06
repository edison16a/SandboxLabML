import type { Arg, BinaryOp, Expr } from './ast';
import type { UnitName } from './units';

const BINARY_PREC: Record<BinaryOp, number> = {
  or: 1,
  and: 2,
  '<': 4,
  '>': 4,
  '<=': 4,
  '>=': 4,
  '==': 4,
  '!=': 4,
  '+': 5,
  '-': 5,
  '*': 6,
  '/': 6,
  '%': 6,
};

const NOT_PREC = 3;
const CMP_PREC = 4;
const UNARY_PREC = 7;
const ATOM_PREC = 8;

function prec(e: Expr): number {
  if (e.kind === 'binary') return BINARY_PREC[e.op];
  if (e.kind === 'unary') return e.op === 'not' ? NOT_PREC : UNARY_PREC;
  return ATOM_PREC;
}

/** Shortest text that reads back as the same number. `String` already guarantees that round trip. */
export function formatNumber(value: number): string {
  return Number.isFinite(value) ? String(value) : '0';
}

export function formatUnit(unit: UnitName): string {
  if (unit === '') return '';
  return unit === '%' ? '%' : ` ${unit}`;
}

export function quote(text: string): string {
  return `"${text.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t')}"`;
}

const wrap = (text: string, needed: boolean) => (needed ? `(${text})` : text);

/**
 * Prints an expression with the fewest parentheses that keep its meaning.
 * The tree has no parenthesis nodes, so `(a + b) * c` gets its parentheses
 * back from precedence alone, and redundant ones disappear.
 */
export function printExpr(e: Expr): string {
  switch (e.kind) {
    case 'number':
      return formatNumber(e.value) + formatUnit(e.unit);
    case 'string':
      return quote(e.value);
    case 'bool':
      return e.value ? 'true' : 'false';
    case 'name':
      return e.path.join('.');
    case 'unary': {
      if (e.op === 'not') return `not ${wrap(printExpr(e.operand), prec(e.operand) < NOT_PREC)}`;
      // A nested sign gets parentheses so `-(-x)` never prints as `--x`.
      return `${e.op}${wrap(printExpr(e.operand), prec(e.operand) < ATOM_PREC)}`;
    }
    case 'binary': {
      const p = BINARY_PREC[e.op];
      const lp = prec(e.left);
      const rp = prec(e.right);
      const left = wrap(printExpr(e.left), lp < p || (p === CMP_PREC && lp === CMP_PREC));
      const right = wrap(printExpr(e.right), rp <= p);
      return `${left} ${e.op} ${right}`;
    }
    case 'call': {
      const callee = e.callee.kind === 'name' || e.callee.kind === 'call' ? printExpr(e.callee) : `(${printExpr(e.callee)})`;
      return `${callee}(${printArgs(e.args)})`;
    }
    case 'record':
      return e.fields.length === 0 ? '{}' : `{ ${printArgs(e.fields)} }`;
  }
}

function printArgs(args: Arg[]): string {
  return args.map((a) => (a.name === null ? printExpr(a.value) : `${a.name}: ${printExpr(a.value)}`)).join(', ');
}
