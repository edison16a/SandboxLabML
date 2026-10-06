import type { TickIO } from '../../env/types';
import type { Expr } from '../ast';
import type { CheckResult, ExprInfo } from '../check/context';
import type { BindContext } from '../registry/types';

/**
 * A compiled statement. It returns true when a stop fired, which ends the
 * rest of the tick, so the block runner can bail out without checking
 * `io.stop` after every line.
 */
export type Exec = (view: unknown, io: TickIO) => boolean;

/**
 * What closures are built against. `slots` holds every local of one block,
 * resolved to an index at check time, so reading a local is an array read
 * and running a tick allocates nothing.
 */
export interface Frame {
  check: CheckResult;
  bind: BindContext;
  slots: Float64Array;
}

/** Info the checker recorded. A missing entry means the compiler was handed an unchecked tree, which is a bug. */
export function infoOf(f: Frame, e: Expr): ExprInfo {
  const info = f.check.exprs.get(e);
  if (!info) throw new Error(`Internal error: the ${e.kind} at ${e.span.from} was never checked.`);
  return info;
}

export function constOf(f: Frame, e: Expr): number | null {
  const v = f.check.exprs.get(e)?.value;
  return typeof v === 'number' ? v : null;
}
