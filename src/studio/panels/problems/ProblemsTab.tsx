'use client';

import { CircleAlert, CircleCheck, CircleX, Info, WandSparkles } from 'lucide-react';
import type { Diagnostic } from '@/engine/script';
import { Button } from '@/ui/primitives/Button';
import { analyze } from '../../doc/analyze';
import { lineCol } from '../../doc/textChange';
import { applyQuickFix, fixAllDocument } from '../../state/docActions';
import { selectText, useStudio } from '../../state/studioStore';

const ICONS = {
  error: <CircleX className="size-4 shrink-0 text-danger" aria-label="Error" />,
  warning: <CircleAlert className="size-4 shrink-0 text-warn" aria-label="Warning" />,
  info: <Info className="size-4 shrink-0 text-accent" aria-label="Note" />,
};

/** The checker calls an empty block slot an unknown name `_`. Say what it really is. */
export function problemMessage(d: Diagnostic): string {
  if (d.code === 'unknown-name' && /\b_\.?$/.test(d.message.replace(/\s+$/, ''))) return 'This slot is empty. Give it a value.';
  return d.message;
}

/** Every problem in the script, errors first in reading order, with jump links and quick fixes. */
export function ProblemsTab() {
  const text = useStudio(selectText);
  const readonly = useStudio((s) => s.script?.readonly ?? true);
  const a = analyze(text);
  const fixable = a.diagnostics.some((d) => d.fixes && d.fixes.length > 0);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-[12px] text-muted">
        <span>
          {a.counts.error} {a.counts.error === 1 ? 'error' : 'errors'}, {a.counts.warning} {a.counts.warning === 1 ? 'warning' : 'warnings'}
        </span>
        <Button size="sm" variant="outline" className="ml-auto" disabled={readonly || !fixable} onClick={fixAllDocument}>
          <WandSparkles />
          Fix all
        </Button>
      </div>
      {a.diagnostics.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-[13px] text-muted">
          <CircleCheck className="size-6 text-success" />
          No problems. The script is ready to train.
        </div>
      ) : (
        <ul className="min-h-0 flex-1 overflow-y-auto p-2" aria-label="Problems">
          {a.diagnostics.map((d, i) => {
            const at = lineCol(text, d.span.from);
            return (
              <li key={`${d.code}-${d.span.from}-${i}`} className="rounded-md hover:bg-surface-2">
                <button type="button" onClick={() => useStudio.getState().revealSpan(d.span.from, d.span.to)} className="flex w-full items-start gap-2 px-2 pt-2 pb-1 text-left">
                  {ICONS[d.severity]}
                  <span className="flex min-w-0 flex-col">
                    <span className="text-[13px] text-fg">{problemMessage(d)}</span>
                    <span className="font-mono text-[11px] text-subtle">
                      Line {at.line}, column {at.col}
                    </span>
                  </span>
                </button>
                {d.fixes && d.fixes.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-2 pl-8">
                    {d.fixes.map((f) => (
                      <Button key={f.title} size="sm" variant="secondary" disabled={readonly} onClick={() => applyQuickFix(f, text)}>
                        {f.title}
                      </Button>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
