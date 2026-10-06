import type { BinaryOp } from '../ast';
import type { Reader, Test } from '../registry/types';

/**
 * Comparisons, specialized for a constant on either side. `car.noProgress
 * > 3 s` is the most common condition in scripts, and comparing against a
 * captured number saves a closure call every tick.
 */
export function compileCompare(op: BinaryOp, a: Reader, b: Reader, lk: number | null, rk: number | null): Test {
  if (rk !== null) {
    switch (op) {
      case '<':
        return (v, io) => a(v, io) < rk;
      case '>':
        return (v, io) => a(v, io) > rk;
      case '<=':
        return (v, io) => a(v, io) <= rk;
      case '>=':
        return (v, io) => a(v, io) >= rk;
      case '==':
        return (v, io) => a(v, io) === rk;
      case '!=':
        return (v, io) => a(v, io) !== rk;
    }
  }
  if (lk !== null) {
    switch (op) {
      case '<':
        return (v, io) => lk < b(v, io);
      case '>':
        return (v, io) => lk > b(v, io);
      case '<=':
        return (v, io) => lk <= b(v, io);
      case '>=':
        return (v, io) => lk >= b(v, io);
      case '==':
        return (v, io) => lk === b(v, io);
      case '!=':
        return (v, io) => lk !== b(v, io);
    }
  }
  switch (op) {
    case '<':
      return (v, io) => a(v, io) < b(v, io);
    case '>':
      return (v, io) => a(v, io) > b(v, io);
    case '<=':
      return (v, io) => a(v, io) <= b(v, io);
    case '>=':
      return (v, io) => a(v, io) >= b(v, io);
    case '==':
      return (v, io) => a(v, io) === b(v, io);
    case '!=':
      return (v, io) => a(v, io) !== b(v, io);
    default:
      throw new Error(`Internal error: ${op} is not a comparison.`);
  }
}
