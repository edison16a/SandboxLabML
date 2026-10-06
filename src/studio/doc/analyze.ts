import type { EnvId } from '@/engine/env/types';
import { check, costToMicros, estimateCost, hasErrors, lint, parse, sortDiagnostics, type CheckResult, type Diagnostic, type ParseResult } from '@/engine/script';

/**
 * Microseconds one car costs per tick with the built-in reward: physics,
 * rays and the brain, measured on the Oval on a laptop. The Turbo estimate
 * compares a script's cost against it.
 */
export const BASE_TICK_MICROS = 3;

/** Everything the Studio shows about one version of the text. */
export interface Analysis {
  source: string;
  parsed: ParseResult;
  checked: CheckResult;
  /** Parse and check problems, plus lint warnings once there are no errors. Sorted by position. */
  diagnostics: Diagnostic[];
  /** The first syntax error. While there is one, the blocks view is read only. */
  syntaxError: Diagnostic | null;
  env: EnvId | null;
  counts: { error: number; warning: number; info: number };
  /** Abstract cost per agent per tick, or null while the script has errors. */
  cost: number | null;
  micros: number | null;
  /** Share of built-in Turbo speed the script keeps, 0 to 1. */
  turboShare: number | null;
}

const cache = new Map<string, Analysis>();

/**
 * Parses, checks and lints a text. The status line, the panels and the
 * blocks view all ask for the same text on every keystroke, so the last few
 * results are kept and shared.
 */
export function analyze(source: string): Analysis {
  const hit = cache.get(source);
  if (hit) return hit;
  const parsed = parse(source);
  const checked = check(parsed.program);
  const early = [...parsed.diagnostics, ...checked.diagnostics];
  const clean = !hasErrors(early);
  const diagnostics = sortDiagnostics(clean ? [...early, ...lint(checked)] : early);
  const counts = { error: 0, warning: 0, info: 0 };
  for (const d of diagnostics) counts[d.severity]++;
  const cost = clean ? estimateCost(checked) : null;
  const micros = cost === null ? null : costToMicros(cost);
  const result: Analysis = {
    source,
    parsed,
    checked,
    diagnostics,
    syntaxError: parsed.diagnostics.find((d) => d.severity === 'error') ?? null,
    env: checked.env,
    counts,
    cost,
    micros,
    turboShare: micros === null ? null : BASE_TICK_MICROS / (BASE_TICK_MICROS + micros),
  };
  if (cache.size >= 6) cache.delete(cache.keys().next().value as string);
  cache.set(source, result);
  return result;
}
