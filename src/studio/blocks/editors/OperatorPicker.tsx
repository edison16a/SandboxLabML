'use client';

import { cn } from '@/ui/cn';

const WORDS: Record<string, string> = {
  '>': 'above',
  '<': 'below',
  '>=': 'at least',
  '<=': 'at most',
  '==': 'equals',
  '!=': 'is not',
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divided by',
  '%': 'modulo',
  and: 'both true',
  or: 'either true',
  not: 'flip',
};

interface Props {
  value: string;
  options: readonly string[];
  onPick: (op: string) => void;
}

/** Operators of one family as buttons with a word each, so `>=` reads as "at least". */
export function OperatorPicker({ value, options, onPick }: Props) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Operator">
      {options.map((op) => (
        <button
          key={op}
          type="button"
          role="radio"
          aria-checked={op === value}
          onClick={() => onPick(op)}
          className={cn(
            'flex flex-col items-center rounded-md border px-1.5 py-1 transition-colors',
            op === value ? 'border-accent bg-accent-soft text-fg' : 'border-border text-fg hover:border-border-strong hover:bg-surface-3',
          )}
        >
          <span className="font-mono text-[13px]">{op}</span>
          <span className="text-[10px] text-muted">{WORDS[op] ?? ''}</span>
        </button>
      ))}
    </div>
  );
}
