import type { Expr, RewardStmt } from '../ast';
import type { CheckResult } from '../check/context';
import type { Span } from '../diagnostics';
import { entriesByName } from '../registry';
import { toBase } from '../units';
import { walkExpr, walkStmts } from '../walk';

export type Report = (code: string, message: string, span: Span, severity?: 'warning' | 'info') => void;

export function rewardsIn(check: CheckResult): RewardStmt[] {
  const out: RewardStmt[] = [];
  for (const item of check.program.items) {
    if (item.kind === 'each' && item.event === 'tick') walkStmts(item.body, (s) => s.kind === 'reward' && out.push(s));
  }
  return out;
}

function readsProgress(check: CheckResult, e: Expr): boolean {
  let found = false;
  walkExpr(e, (x) => {
    const ref = check.exprs.get(x)?.ref;
    if (ref?.kind === 'entry' && ref.entry.progress) found = true;
  });
  return found;
}

/**
 * Without a reward for getting somewhere, the easiest way to avoid
 * penalties is to sit still, and evolution finds that fast.
 */
export function lintProgressReward(check: CheckResult, report: Report): void {
  const progress = [...entriesByName(check.env).values()].filter((e) => e.progress);
  if (progress.length === 0) return;
  const tick = check.program.items.find((i) => i.kind === 'each' && i.event === 'tick');
  if (!tick || tick.kind !== 'each') return;
  const rewarded = rewardsIn(check).some((r) => readsProgress(check, r.value) || (r.when !== null && readsProgress(check, r.when)));
  if (rewarded) return;
  const examples = progress.slice(0, 3).map((e) => e.name).join(', ');
  report('no-progress-reward', `No reward mentions progress, such as ${examples}. Agents may learn to stand still.`, { from: tick.span.from, to: tick.body.span.from + 1 });
}

/** Largest number written in a reward, in base units. Rewards with no number in them are skipped. */
function magnitude(e: Expr): number | null {
  let best: number | null = null;
  walkExpr(e, (x) => {
    if (x.kind === 'number') best = Math.max(best ?? 0, Math.abs(toBase(x.value, x.unit)));
  });
  return best;
}

/** One huge reward drowns out the rest, so evolution ignores everything else the script asks for. */
export function lintDominantReward(check: CheckResult, report: Report): void {
  const sized = rewardsIn(check)
    .map((r) => ({ r, size: magnitude(r.value) }))
    .filter((x): x is { r: RewardStmt; size: number } => x.size !== null && x.size > 0)
    .sort((a, b) => b.size - a.size);
  if (sized.length < 2 || sized[0].size <= 100 * sized[1].size) return;
  report('dominant-reward', 'This reward is more than 100 times larger than any other, so the others will barely count.', sized[0].r.span);
}
