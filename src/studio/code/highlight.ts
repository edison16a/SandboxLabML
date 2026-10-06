import { RangeSetBuilder } from '@codemirror/state';
import { Decoration, ViewPlugin, type DecorationSet, type EditorView, type ViewUpdate } from '@codemirror/view';
import { tokenize, type HighlightKind } from '@/engine/script';

/** Kinds that get a color. Names and punctuation keep the plain text color. */
const COLORED: ReadonlySet<HighlightKind> = new Set(['keyword', 'number', 'unit', 'string', 'comment', 'operator', 'invalid']);

const marks = new Map<HighlightKind, Decoration>([...COLORED].map((k) => [k, Decoration.mark({ class: `sbl-${k}` })]));

function build(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  let last = -1;
  for (const span of tokenize(doc.toString())) {
    const mark = marks.get(span.kind);
    if (!mark || span.from < last || span.to > doc.length || span.to <= span.from) continue;
    builder.add(span.from, span.to, mark);
    last = span.to;
  }
  return builder.finish();
}

/**
 * Syntax colors from the language's own tokenizer instead of a separate
 * grammar, so the editor can never color a word differently from how the
 * parser reads it (such as `brain` on its own line versus `brain.steer`).
 * Scripts are small, so the whole text is retokenized on each change.
 */
export const sblHighlight = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      if (u.docChanged) this.decorations = build(u.view);
    }
  },
  { decorations: (v) => v.decorations },
);
