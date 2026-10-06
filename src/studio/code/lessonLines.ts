import { RangeSetBuilder, StateEffect, StateField, type Text } from '@codemirror/state';
import { Decoration, EditorView, type DecorationSet } from '@codemirror/view';

/** Sets the 1-based lines a lesson step points at. An empty list clears them. */
export const setLessonLines = StateEffect.define<number[]>();

const line = Decoration.line({ class: 'cm-lessonLine' });

function decorate(doc: Text, lines: number[]): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  for (const n of [...new Set(lines)].sort((a, b) => a - b)) {
    if (n >= 1 && n <= doc.lines) builder.add(doc.line(n).from, doc.line(n).from, line);
  }
  return builder.finish();
}

/** Lines highlighted by the Learn tab. They follow edits, so typing above them does not shift the highlight off target. */
export const lessonLines = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    let next = value.map(tr.changes);
    for (const e of tr.effects) if (e.is(setLessonLines)) next = decorate(tr.state.doc, e.value);
    return next;
  },
  provide: (f) => EditorView.decorations.from(f),
});
