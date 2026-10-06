'use client';

import { useEffect, useRef } from 'react';
import { EditorSelection, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { minimalChange } from '../doc/textChange';
import { useStudio, type StudioState } from '../state/studioStore';
import { fromStore, readOnlyCompartment, studioExtensions } from './extensions';
import { setLessonLines } from './lessonLines';

/**
 * Brings the editor in line with the store: a new script replaces the
 * whole document, anything else (undo, redo, a block edit) is applied as
 * the smallest change so the cursor and scroll position survive.
 */
function syncFromStore(view: EditorView, s: StudioState, scriptChanged: boolean): void {
  const doc = view.state.doc.toString();
  const text = s.history.present;
  const readOnly = EditorState.readOnly.of(s.script?.readonly ?? true);
  if (scriptChanged) {
    view.dispatch({
      changes: { from: 0, to: doc.length, insert: text },
      selection: EditorSelection.cursor(0),
      annotations: fromStore.of(true),
      effects: [readOnlyCompartment.reconfigure(readOnly), setLessonLines.of(s.highlightLines)],
      scrollIntoView: true,
    });
    return;
  }
  const change = minimalChange(doc, text);
  if (change) view.dispatch({ changes: change, annotations: fromStore.of(true) });
}

function reveal(view: EditorView, from: number, to: number): void {
  const len = view.state.doc.length;
  view.dispatch({ selection: EditorSelection.range(Math.min(from, len), Math.min(to, len)), scrollIntoView: true });
  view.focus();
}

/**
 * The code view. CodeMirror is created once and talks to the Studio store
 * in both directions: edits go up through an update listener, and changes
 * made elsewhere come down through a store subscription. This file is the
 * only entry point to CodeMirror, so the route loads it lazily.
 */
export default function CodeEditor() {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const start = useStudio.getState();
    const view = new EditorView({ parent: el, state: EditorState.create({ doc: start.history.present, extensions: studioExtensions(start.script?.readonly ?? true) }) });
    view.dispatch({ effects: setLessonLines.of(start.highlightLines) });
    if (start.reveal) {
      reveal(view, start.reveal.from, start.reveal.to);
      useStudio.setState({ reveal: null });
    }

    let alive = true;
    const later = (fn: () => void) => queueMicrotask(() => alive && fn());
    const unsubscribe = useStudio.subscribe((s, prev) => {
      const scriptChanged = s.script?.id !== prev.script?.id;
      if (scriptChanged || s.history.present !== prev.history.present || s.script?.readonly !== prev.script?.readonly) {
        // Deferred, because an edit typed in the editor lands here while CodeMirror is still inside its update.
        later(() => syncFromStore(view, useStudio.getState(), scriptChanged));
      }
      if (s.highlightLines !== prev.highlightLines) later(() => view.dispatch({ effects: setLessonLines.of(s.highlightLines) }));
      if (s.reveal && s.reveal !== prev.reveal) {
        const r = s.reveal;
        later(() => {
          reveal(view, r.from, r.to);
          useStudio.setState({ reveal: null });
        });
      }
    });
    return () => {
      alive = false;
      unsubscribe();
      view.destroy();
    };
  }, []);

  return <div ref={host} className="h-full min-h-0 overflow-hidden" data-testid="code-editor" />;
}
