import { EditorSelection } from '@codemirror/state';
import { hoverTooltip, type EditorView } from '@codemirror/view';
import { toast } from '@/ui/toast/toastStore';
import { analyze } from '../doc/analyze';
import { insertBelowLine } from '../doc/insert';
import { minimalChange } from '../doc/textChange';
import { lookupEntry } from '../reference/entryDocs';
import { hoverCard } from './docCard';

const WORD = /[\w.]/;

/** The dotted name under a position, such as `car.speed` when hovering over `speed`. */
export function wordAt(text: string, pos: number): { from: number; to: number; word: string } | null {
  let from = pos;
  let to = pos;
  while (from > 0 && WORD.test(text[from - 1])) from--;
  while (to < text.length && WORD.test(text[to])) to++;
  const word = text.slice(from, to).replace(/^\.+|\.+$/g, '');
  return word && /^[A-Za-z_]/.test(word) ? { from, to, word } : null;
}

function insertAt(view: EditorView, pos: number, example: string): void {
  if (view.state.readOnly) {
    toast.info('Presets are read only', 'Duplicate it to make a copy you can edit.');
    return;
  }
  const doc = view.state.doc.toString();
  const { text, cursor } = insertBelowLine(doc, pos, example);
  const change = minimalChange(doc, text);
  if (!change) return;
  view.dispatch({ changes: change, selection: EditorSelection.cursor(cursor), scrollIntoView: true, userEvent: 'input.example' });
  view.focus();
}

/** Docs for registry names under the mouse, with a button that inserts the example below the hovered line. */
export const sblHover = hoverTooltip(
  (view, pos) => {
    const text = view.state.doc.toString();
    const hit = wordAt(text, pos);
    if (!hit) return null;
    const entry = lookupEntry(analyze(text).env ?? 'racing', hit.word);
    if (!entry) return null;
    return {
      pos: hit.from,
      end: hit.to,
      above: true,
      create: () => ({ dom: hoverCard(entry, () => insertAt(view, pos, entry.example)) }),
    };
  },
  { hoverTime: 350 },
);
