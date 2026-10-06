import { EditorState, type Extension } from '@codemirror/state';
import { indentOnInput, indentService, indentUnit } from '@codemirror/language';
import { braceDepth } from './context';

/**
 * Indentation without a grammar: a line sits one level deeper for every
 * unclosed `{` above it, and a line that starts with `}` steps back out.
 * That matches the printer's two space style exactly.
 */
const service = indentService.of((ctx, pos) => {
  const depth = braceDepth(ctx.state.doc.sliceString(0, pos));
  const closes = /^\s*\}/.test(ctx.textAfterPos(pos));
  return Math.max(0, depth - (closes ? 1 : 0)) * ctx.unit;
});

/** Language facts the stock commands read: comment toggling, brackets to close and when to reindent. */
const data = EditorState.languageData.of(() => [
  {
    commentTokens: { line: '//' },
    closeBrackets: { brackets: ['(', '[', '{', '"'] },
    indentOnInput: /^\s*\}$/,
  },
]);

export const sblIndentation: Extension = [indentUnit.of('  '), service, data, indentOnInput()];
