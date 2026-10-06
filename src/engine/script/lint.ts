import type { CheckResult } from './check/context';
import { costToMicros, estimateCost, HIGH_COST } from './cost';
import { makeDiagnostic, type Diagnostic, type Span } from './diagnostics';
import { lintConditions } from './lint/conditions';
import { lintDominantReward, lintProgressReward, type Report } from './lint/rewards';
import { entriesFor } from './registry';
import { eachBlock, walkBlockExprs } from './walk';

/**
 * Warnings about scripts that are valid but probably not what the author
 * wants. Lint never blocks a run: every diagnostic here is a warning or an
 * info. Run it only on scripts that checked without errors.
 */
export function lint(check: CheckResult): Diagnostic[] {
  const out: Diagnostic[] = [];
  const report: Report = (code, message, span, severity = 'warning') => out.push(makeDiagnostic(severity, code, message, span));
  lintProgressReward(check, report);
  lintDominantReward(check, report);
  lintConditions(check, report);
  lintUnused(check, report);
  lintConstantSensors(check, report);
  lintActions(check, report);
  lintOperators(check, report);
  lintCost(check, report);
  return out;
}

function headSpan(check: CheckResult, event: 'tick' | 'generation'): Span {
  const item = check.program.items.find((i) => i.kind === 'each' && i.event === event);
  if (item && item.kind === 'each') return { from: item.span.from, to: item.body.span.from + 1 };
  return check.program.header?.span ?? { from: 0, to: 0 };
}

function lintUnused(check: CheckResult, report: Report): void {
  for (const d of check.declarations) {
    if (!d.used && d.kind !== 'sensor') report('unused', `${d.name} is never used.`, d.span);
  }
}

function lintConstantSensors(check: CheckResult, report: Report): void {
  for (const item of check.program.items) {
    if (item.kind === 'sensor' && check.exprs.get(item.value)?.value !== undefined) {
      report('constant-sensor', 'This sensor always reads the same value, so it tells the brain nothing.', item.value.span);
    }
  }
}

/** Names of the registry entries of one kind that a block calls. */
function calledIn(check: CheckResult, event: 'tick' | 'generation', kind: string): Set<string> {
  const block = eachBlock(check.program, event);
  const out = new Set<string>();
  if (block) {
    walkBlockExprs(block, (e) => {
      const entry = e.kind === 'call' ? check.calls.get(e)?.entry : undefined;
      if (entry?.kind === kind) out.add(entry.name);
    });
  }
  return out;
}

/** With no action call, the env zeroes the controls every tick and agents never move. */
function lintActions(check: CheckResult, report: Report): void {
  const actions = entriesFor(check.env, 'tick').filter((e) => e.kind === 'action');
  if (actions.length === 0 || calledIn(check, 'tick', 'action').size > 0) return;
  const example = actions[0].example;
  if (!eachBlock(check.program, 'tick')) {
    report('no-action', `There is no each tick block, so agents never act. Add one with ${example}.`, headSpan(check, 'tick'));
  } else {
    report('no-action', `each tick never calls an action, so agents will not move. Add ${example}.`, headSpan(check, 'tick'));
  }
}

function lintOperators(check: CheckResult, report: Report): void {
  if (!eachBlock(check.program, 'generation')) {
    report('no-generation', 'There is no each generation block, so evolution uses the default settings.', headSpan(check, 'generation'), 'info');
    return;
  }
  const called = calledIn(check, 'generation', 'operator');
  const missing = entriesFor(check.env, 'generation')
    .filter((e) => e.kind === 'operator' && e.env === 'core' && !called.has(e.name))
    .map((e) => `${e.name}()`);
  if (missing.length === 0) return;
  const verb = missing.length === 1 ? 'is not called, so it uses its' : 'are not called, so they use their';
  report('missing-operators', `${missing.join(', ')} ${verb} default settings.`, headSpan(check, 'generation'));
}

function lintCost(check: CheckResult, report: Report): void {
  const cost = estimateCost(check);
  if (cost <= HIGH_COST) return;
  const micros = costToMicros(cost).toFixed(1);
  report('high-cost', `This script costs about ${micros} µs per agent per tick, which will slow training down.`, headSpan(check, 'tick'));
}
