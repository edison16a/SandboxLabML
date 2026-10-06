import { closeBrackets, closeBracketsKeymap, completionKeymap } from '@codemirror/autocomplete';
import { defaultKeymap, indentWithTab, toggleComment } from '@codemirror/commands';
import { bracketMatching } from '@codemirror/language';
import { lintKeymap } from '@codemirror/lint';
import { Annotation, Compartment, EditorState, type Extension, type Transaction } from '@codemirror/state';
import { drawSelection, dropCursor, EditorView, highlightActiveLine, highlightActiveLineGutter, keymap, lineNumbers } from '@codemirror/view';
import { formatDocument, fixAllDocument } from '../state/docActions';
import { useStudio } from '../state/studioStore';
import { sblCompletion } from './complete';
import { sblHover } from './hover';
import { sblHighlight } from './highlight';
import { sblIndentation } from './indent';
import { lessonLines } from './lessonLines';
import { sblLint } from './lint';
import { sblTheme } from './theme';

/** Marks changes that came from the store (undo, block edits), so they are not echoed back as new edits. */
export const fromStore = Annotation.define<boolean>();

export const readOnlyCompartment = new Compartment();

const run = (fn: () => unknown) => () => {
  void fn();
  return true;
};

/**
 * Undo and redo go to the Studio's own stack instead of CodeMirror's, so a
 * block edit and a keystroke undo in the same order whichever view made
 * them. That is also why the history extension is left out.
 */
const studioKeymap = keymap.of([
  { key: 'Mod-z', run: run(() => useStudio.getState().undo()), preventDefault: true },
  { key: 'Mod-y', run: run(() => useStudio.getState().redo()), preventDefault: true },
  { key: 'Mod-Shift-z', run: run(() => useStudio.getState().redo()), preventDefault: true },
  // Ctrl or Cmd with S is handled once for the whole page by useStudioShortcuts; here it only stops the browser's save dialog.
  { key: 'Mod-s', run: () => true, preventDefault: true },
  { key: 'Shift-Alt-f', run: run(formatDocument) },
  { key: 'Mod-Shift-.', run: run(fixAllDocument) },
  { key: 'Mod-/', run: toggleComment },
]);

/** Undo groups for the Studio history: typing merges, deleting merges, everything else is a step of its own. */
export function undoGroup(tr: Transaction): string | undefined {
  if (tr.isUserEvent('input.type')) return 'type';
  if (tr.isUserEvent('delete')) return 'delete';
  return undefined;
}

/** Sends text and cursor changes made in the editor to the store. */
const toStore = EditorView.updateListener.of((u) => {
  const studio = useStudio.getState();
  if (u.docChanged && !u.transactions.some((t) => t.annotation(fromStore))) {
    const tr = u.transactions.find((t) => t.docChanged);
    studio.edit(u.state.doc.toString(), tr ? undoGroup(tr) : undefined);
  }
  if (u.selectionSet || u.docChanged) {
    const head = u.state.selection.main.head;
    if (head !== studio.cursor) useStudio.setState({ cursor: head });
  }
});

export function studioExtensions(readOnly: boolean): Extension[] {
  return [
    lineNumbers(),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    drawSelection(),
    dropCursor(),
    bracketMatching(),
    closeBrackets(),
    sblIndentation,
    sblHighlight,
    sblLint,
    sblCompletion,
    sblHover,
    lessonLines,
    sblTheme,
    EditorView.lineWrapping,
    EditorView.contentAttributes.of({ 'aria-label': 'Script code', spellcheck: 'false' }),
    readOnlyCompartment.of(EditorState.readOnly.of(readOnly)),
    studioKeymap,
    keymap.of([...closeBracketsKeymap, ...completionKeymap, ...lintKeymap, ...defaultKeymap, indentWithTab]),
    toStore,
  ];
}
