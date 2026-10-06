/**
 * Diagnostics shared by the lexer, parser, checker, linter and autocorrect.
 * Every stage reports problems the same way, so the editor can underline
 * them and offer quick fixes without caring which stage found them.
 */

/** Character offsets into the source. `to` is exclusive. */
export interface Span {
  from: number;
  to: number;
}

export interface TextEdit {
  from: number;
  to: number;
  insert: string;
}

/** One way to fix a problem. All of its edits are applied together. */
export interface QuickFix {
  title: string;
  edits: TextEdit[];
}

export type Severity = 'error' | 'warning' | 'info';

export interface Diagnostic {
  severity: Severity;
  /** Stable identifier such as "unknown-name". Tests and lint filters use it. */
  code: string;
  message: string;
  span: Span;
  fixes?: QuickFix[];
}

export function makeDiagnostic(severity: Severity, code: string, message: string, span: Span, fixes?: QuickFix[]): Diagnostic {
  const d: Diagnostic = { severity, code, message, span: { from: span.from, to: span.to } };
  if (fixes && fixes.length > 0) d.fixes = fixes;
  return d;
}

export function hasErrors(diagnostics: readonly Diagnostic[]): boolean {
  return diagnostics.some((d) => d.severity === 'error');
}

/** A fix that swaps the text of one span for something else. */
export function replaceFix(title: string, span: Span, insert: string): QuickFix {
  return { title, edits: [{ from: span.from, to: span.to, insert }] };
}

export function insertFix(title: string, at: number, insert: string): QuickFix {
  return { title, edits: [{ from: at, to: at, insert }] };
}

/**
 * Applies edits that do not overlap. Edits are applied from the end of the
 * text backwards so the offsets of earlier edits stay valid. Overlapping
 * edits are skipped rather than mangling the text.
 */
export function applyEdits(source: string, edits: readonly TextEdit[]): string {
  const sorted = [...edits].sort((a, b) => b.from - a.from || b.to - a.to);
  let out = source;
  let limit = Infinity;
  for (const e of sorted) {
    if (e.to > limit) continue;
    out = out.slice(0, e.from) + e.insert + out.slice(e.to);
    limit = e.from;
  }
  return out;
}

/** 1-based line number of an offset, for messages like "opened on line 4". */
export function lineOf(source: string, offset: number): number {
  let line = 1;
  const end = Math.min(offset, source.length);
  for (let i = 0; i < end; i++) if (source.charCodeAt(i) === 10) line++;
  return line;
}

/** Errors first, then by position, so the editor and tests see a stable order. */
export function sortDiagnostics(diagnostics: Diagnostic[]): Diagnostic[] {
  const rank = { error: 0, warning: 1, info: 2 };
  return diagnostics.sort((a, b) => a.span.from - b.span.from || rank[a.severity] - rank[b.severity]);
}
