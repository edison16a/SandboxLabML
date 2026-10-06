import { applyEdits, fixAll, lineOf, print, type QuickFix } from '@/engine/script';
import { toast } from '@/ui/toast/toastStore';
import { analyze } from '../doc/analyze';
import { appendToSection, insertBelowLine, type InsertScope } from '../doc/insert';
import { useStudio } from './studioStore';

/**
 * Text commands shared by the toolbar, the code editor's keymap and the
 * panels. Each one reads the present text, makes one new text and commits
 * it as a single undo step.
 */

function current(): { text: string; readonly: boolean } {
  const s = useStudio.getState();
  return { text: s.history.present, readonly: s.script?.readonly ?? true };
}

function refuseReadonly(): boolean {
  if (!current().readonly) return false;
  toast.info('Presets are read only', 'Duplicate it to make a copy you can edit.');
  return true;
}

/** Reprints the script in the canonical style. Refused while there is a syntax error, since that would drop the broken line. */
export function formatDocument(): void {
  if (refuseReadonly()) return;
  const { text } = current();
  const a = analyze(text);
  if (a.syntaxError) {
    toast.info('Fix the syntax error first', `Formatting would lose line ${lineOf(text, a.syntaxError.span.from)}.`);
    return;
  }
  useStudio.getState().edit(print(a.parsed.program));
}

/** Applies every fix with one clear choice. */
export function fixAllDocument(): void {
  if (refuseReadonly()) return;
  const { text } = current();
  const result = fixAll(text);
  if (result.applied.length === 0) {
    toast.info('Nothing to fix automatically', 'The remaining problems need a decision from you.');
    return;
  }
  useStudio.getState().edit(result.source);
  toast.success(`Applied ${result.applied.length} fix${result.applied.length === 1 ? '' : 'es'}`, result.applied.slice(0, 3).join('. '));
}

/** Applies one quick fix, as long as the text has not changed since the fix was computed. */
export function applyQuickFix(fix: QuickFix, source: string): void {
  if (refuseReadonly()) return;
  const { text } = current();
  if (text !== source) return;
  useStudio.getState().edit(applyEdits(text, fix.edits));
}

/**
 * Inserts an example: below the cursor in the code view, or at the end of
 * the matching section in the blocks view.
 */
export function insertExample(example: string, scope: InsertScope): void {
  if (refuseReadonly()) return;
  const s = useStudio.getState();
  const text = s.history.present;
  if (s.mode === 'code') {
    const { text: next, cursor } = insertBelowLine(text, s.cursor, example);
    s.edit(next);
    s.revealSpan(cursor - example.split('\n').pop()!.length, cursor);
    return;
  }
  const next = appendToSection(text, scope, example);
  if (next === null) {
    toast.info('Fix the syntax error first', 'Blocks can be added once the script reads cleanly.');
    return;
  }
  s.edit(next);
  toast.success('Block added', `Added to ${scope === 'top' ? 'the top level' : `each ${scope}`}.`);
}
