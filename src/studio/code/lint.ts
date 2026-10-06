import type { Extension } from '@codemirror/state';
import { linter, lintGutter, type Diagnostic as CmDiagnostic } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import type { Diagnostic, QuickFix } from '@/engine/script';
import { analyze } from '../doc/analyze';

function action(fix: QuickFix, source: string) {
  return {
    name: fix.title,
    apply(view: EditorView) {
      // Offsets belong to the text the fix was computed for. If it changed since, the lint pass will offer a fresh fix.
      if (view.state.readOnly || view.state.doc.toString() !== source) return;
      view.dispatch({ changes: fix.edits.map((e) => ({ from: e.from, to: e.to, insert: e.insert })), userEvent: 'input.fix' });
    },
  };
}

function toCm(d: Diagnostic, source: string): CmDiagnostic {
  const from = Math.min(d.span.from, source.length);
  const to = Math.max(from, Math.min(d.span.to, source.length));
  return {
    from,
    to,
    severity: d.severity,
    message: d.message,
    source: d.code,
    actions: (d.fixes ?? []).map((f) => action(f, source)),
  };
}

/**
 * Underlines from the checker and the linter, with their quick fixes as
 * buttons in the tooltip. It reads the same cached analysis as the
 * Problems tab, so both always list the same problems.
 */
export const sblLint: Extension = [
  linter(
    (view) => {
      const source = view.state.doc.toString();
      return analyze(source).diagnostics.map((d) => toCm(d, source));
    },
    { delay: 200 },
  ),
  lintGutter(),
];
