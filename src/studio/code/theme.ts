import { EditorView } from '@codemirror/view';

/**
 * Editor colors from the app's design tokens, so the code view sits in the
 * dark theme like every other panel. Keywords are blue and numbers with
 * units orange, the same pair the logo and charts use.
 */
export const sblTheme = EditorView.theme(
  {
    '&': { height: '100%', backgroundColor: 'var(--color-bg)', color: 'var(--color-fg)', fontSize: '13px' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: '1.65' },
    '.cm-content': { caretColor: 'var(--color-accent)', padding: '12px 0 40vh' },
    '.cm-gutters': { backgroundColor: 'var(--color-bg)', color: 'var(--color-subtle)', border: 'none', paddingLeft: '6px' },
    '.cm-lineNumbers .cm-gutterElement': { padding: '0 10px 0 6px', minWidth: '32px' },
    '.cm-activeLine': { backgroundColor: '#ffffff05' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: 'var(--color-muted)' },
    '&.cm-focused .cm-cursor': { borderLeftColor: 'var(--color-accent)', borderLeftWidth: '2px' },
    '.cm-selectionBackground, &.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground': { backgroundColor: '#4c9aff38' },
    '.cm-matchingBracket, &.cm-focused .cm-matchingBracket': { backgroundColor: '#4c9aff26', outline: '1px solid #4c9aff55' },
    '.cm-tooltip': {
      backgroundColor: 'var(--color-surface-2)',
      border: '1px solid var(--color-border-strong)',
      borderRadius: '8px',
      color: 'var(--color-fg)',
      boxShadow: '0 12px 32px #00000066',
      overflow: 'hidden',
    },
    '.cm-tooltip-autocomplete > ul': { fontFamily: 'var(--font-mono)', fontSize: '12px', maxHeight: '18em' },
    '.cm-tooltip-autocomplete > ul > li': { padding: '3px 10px' },
    '.cm-tooltip-autocomplete > ul > li[aria-selected]': { backgroundColor: 'var(--color-surface-3)', color: 'var(--color-fg)' },
    '.cm-completionDetail': { color: 'var(--color-muted)', fontStyle: 'normal', marginLeft: '12px', fontFamily: 'var(--font-sans)' },
    '.cm-completionMatchedText': { textDecoration: 'none', color: 'var(--color-accent)' },
    '.cm-completionInfo': { padding: '8px 10px', maxWidth: '320px', fontSize: '12px', lineHeight: '1.5' },
    '.cm-diagnostic': { padding: '6px 10px', fontSize: '12px', borderLeftWidth: '3px' },
    '.cm-diagnostic-error': { borderLeftColor: 'var(--color-danger)' },
    '.cm-diagnostic-warning': { borderLeftColor: 'var(--color-warn)' },
    '.cm-diagnostic-info': { borderLeftColor: 'var(--color-accent)' },
    '.cm-diagnosticAction': {
      backgroundColor: 'var(--color-surface-3)',
      color: 'var(--color-fg)',
      border: '1px solid var(--color-border-strong)',
      borderRadius: '5px',
      padding: '1px 8px',
      marginLeft: '0',
      marginRight: '6px',
      marginTop: '6px',
      font: '500 12px var(--font-sans)',
    },
    '.cm-lintRange-error': { backgroundImage: 'none', textDecoration: 'underline wavy var(--color-danger)', textUnderlineOffset: '3px', textDecorationSkipInk: 'none' },
    '.cm-lintRange-warning': { backgroundImage: 'none', textDecoration: 'underline wavy var(--color-warn)', textUnderlineOffset: '3px', textDecorationSkipInk: 'none' },
    '.cm-lintRange-info': { backgroundImage: 'none', textDecoration: 'underline dotted var(--color-accent)', textUnderlineOffset: '3px' },
    '.cm-lintPoint-error:after': { borderBottomColor: 'var(--color-danger)' },
    '.cm-gutter-lint': { width: '14px' },
    '.cm-lessonLine': { backgroundColor: '#f5c45114', boxShadow: 'inset 2px 0 var(--color-warn)' },
    '.sbl-keyword': { color: 'var(--color-accent)' },
    '.sbl-number, .sbl-unit': { color: 'var(--color-orange)' },
    '.sbl-string': { color: 'var(--color-success)' },
    '.sbl-comment': { color: 'var(--color-subtle)', fontStyle: 'italic' },
    '.sbl-operator': { color: 'var(--color-muted)' },
    '.sbl-invalid': { color: 'var(--color-danger)' },
  },
  { dark: true },
);
