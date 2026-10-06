'use client';

import { useState } from 'react';
import { MessageSquareText } from 'lucide-react';

interface Props {
  text: string;
  readOnly: boolean;
  /** Called with null when the note is cleared, which removes the comment lines. */
  onCommit: (text: string | null) => void;
  /** Open in edit mode, used right after "Add note". */
  startEditing?: boolean;
  /** Called when editing ends without a change, so a note that was never written can close again. */
  onCancel?: () => void;
}

/**
 * The comment lines above a statement, shown as a note. Comments are part
 * of the tree, so they survive switching views and every block edit.
 */
export function BlockNote({ text, readOnly, onCommit, startEditing = false, onCancel }: Props) {
  const [draft, setDraft] = useState<string | null>(startEditing ? text : null);
  const commit = () => {
    if (draft === null) return;
    const clean = draft.replace(/\r/g, '').trimEnd();
    if (clean !== text) onCommit(clean === '' ? null : clean);
    else onCancel?.();
    setDraft(null);
  };
  if (draft !== null) {
    return (
      <textarea
        autoFocus
        aria-label="Note"
        value={draft}
        rows={Math.max(1, draft.split('\n').length)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Escape') {
            setDraft(null);
            onCancel?.();
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) commit();
        }}
        className="mb-1 w-full resize-none rounded-md border border-accent bg-bg px-2 py-1 text-[12px] leading-relaxed text-fg focus:outline-none"
      />
    );
  }
  return (
    <button
      type="button"
      disabled={readOnly}
      onClick={() => setDraft(text)}
      title={readOnly ? undefined : 'Edit note'}
      className="mb-1 flex w-full items-start gap-1.5 rounded-md px-1 py-0.5 text-left text-[12px] leading-relaxed text-subtle italic hover:bg-surface-2 disabled:hover:bg-transparent"
    >
      <MessageSquareText className="mt-0.5 size-3.5 shrink-0" />
      <span className="whitespace-pre-wrap">{text || 'Empty note'}</span>
    </button>
  );
}
