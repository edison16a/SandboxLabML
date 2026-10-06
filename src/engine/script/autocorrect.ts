import { check, type CheckOptions } from './checker';
import { applyEdits, type Diagnostic, type TextEdit } from './diagnostics';
import { parse } from './parser';

export { editDistance, allowedDistance } from './autocorrect/distance';
export { suggest, bestSuggestion, type Suggestion } from './autocorrect/suggest';
export { SNIPPETS, snippetsFor, callSnippets, type Snippet, type SnippetScope } from './autocorrect/snippets';

/**
 * Fixes that need a decision from the author: a missing argument gets a
 * placeholder value and a missing header gets a made-up name. They are
 * offered in the editor but never applied by fixAll.
 */
const NEEDS_A_DECISION = new Set(['missing-arg', 'missing-header']);

export interface FixAllResult {
  source: string;
  /** Titles of the fixes that were applied, in order. */
  applied: string[];
}

/** Parse and check diagnostics, which are the ones that carry fixes. */
export function diagnose(source: string, opts: CheckOptions = {}): Diagnostic[] {
  const parsed = parse(source);
  return [...parsed.diagnostics, ...check(parsed.program, opts).diagnostics];
}

/**
 * Applies every fix that has exactly one choice, or one clear favorite
 * marked preferred, then checks again, since fixing a missing `}` can
 * uncover a misspelled name behind it. Stops when nothing changes, after a
 * few rounds at most.
 */
export function fixAll(source: string, opts: CheckOptions = {}): FixAllResult {
  let text = source;
  const applied: string[] = [];
  for (let round = 0; round < 8; round++) {
    const edits: TextEdit[] = [];
    const titles: string[] = [];
    for (const d of diagnose(text, opts)) {
      if (!d.fixes || NEEDS_A_DECISION.has(d.code)) continue;
      const fix = d.fixes.length === 1 ? d.fixes[0] : d.fixes.find((f) => f.isPreferred);
      if (!fix) continue;
      if (fix.edits.some((e) => edits.some((o) => e.from < o.to && o.from < e.to) || edits.some((o) => o.from === e.from && o.to === e.to))) continue;
      edits.push(...fix.edits);
      titles.push(fix.title);
    }
    if (edits.length === 0) break;
    const next = applyEdits(text, edits);
    if (next === text) break;
    text = next;
    applied.push(...titles);
  }
  return { source: text, applied };
}

/** Rewrites names listed in `renamedFrom` to their current spelling and leaves everything else alone. */
export function migrate(source: string): string {
  const edits = diagnose(source)
    .filter((d) => d.code === 'renamed')
    .flatMap((d) => d.fixes?.[0]?.edits ?? []);
  return applyEdits(source, edits);
}
