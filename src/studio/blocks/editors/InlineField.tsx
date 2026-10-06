'use client';

import { useState } from 'react';
import { cn } from '@/ui/cn';

interface Props {
  value: string;
  label: string;
  onCommit: (value: string) => void;
  readOnly?: boolean;
  /** Draw quotes around the text, for stop reasons and sensor labels. */
  quoted?: boolean;
  pattern?: RegExp;
  numeric?: boolean;
}

/**
 * A word inside a block that can be typed over, such as a let name. It
 * commits on Enter or when focus leaves, never per keystroke, because a
 * commit reprints the script and the block is rebuilt from the new text.
 */
export function InlineField({ value, label, onCommit, readOnly, quoted, pattern, numeric }: Props) {
  const [draft, setDraft] = useState<string | null>(null);
  const text = draft ?? value;
  const valid = !pattern || pattern.test(text);
  const commit = () => {
    if (draft !== null && draft !== value && valid) onCommit(draft);
    setDraft(null);
  };
  if (readOnly) return <span className={cn('font-mono text-[12px]', quoted ? 'text-success' : 'text-fg')}>{quoted ? `"${value}"` : value}</span>;
  return (
    <span className={cn('inline-flex items-center font-mono text-[12px]', quoted && 'text-success')}>
      {quoted && '"'}
      <input
        aria-label={label}
        value={text}
        size={Math.max(2, text.length)}
        inputMode={numeric ? 'numeric' : undefined}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          e.stopPropagation();
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          }
        }}
        className={cn(
          'h-6 rounded border border-transparent bg-transparent px-1 hover:border-border-strong focus:border-accent focus:bg-bg focus:outline-none',
          quoted ? 'text-success' : 'text-fg',
          !valid && 'border-danger focus:border-danger',
        )}
      />
      {quoted && '"'}
    </span>
  );
}
