'use client';

import { CircleAlert, CircleX, Gauge, Zap } from 'lucide-react';
import { analyze } from '../doc/analyze';
import { lineCol } from '../doc/textChange';
import { selectText, useStudio } from '../state/studioStore';

/**
 * The strip under the editor: cursor position, problem counts and what the
 * script costs per agent per tick, with the share of built-in Turbo speed
 * it keeps. Counts open the Problems tab.
 */
export function StatusLine() {
  const text = useStudio(selectText);
  const cursor = useStudio((s) => s.cursor);
  const mode = useStudio((s) => s.mode);
  const a = analyze(text);
  const { line, col } = lineCol(text, cursor);
  return (
    <div className="flex h-7 shrink-0 items-center gap-4 overflow-x-auto border-t border-border bg-bg px-3 text-[11px] whitespace-nowrap text-muted" role="status" aria-label="Script status">
      {mode === 'code' && (
        <span className="tabular font-mono">
          Ln {line}, Col {col}
        </span>
      )}
      <button type="button" onClick={() => useStudio.setState({ panel: 'problems' })} className="inline-flex items-center gap-3 hover:text-fg">
        <span className="inline-flex items-center gap-1">
          <CircleX className={a.counts.error > 0 ? 'size-3.5 text-danger' : 'size-3.5'} />
          {a.counts.error} {a.counts.error === 1 ? 'error' : 'errors'}
        </span>
        <span className="inline-flex items-center gap-1">
          <CircleAlert className={a.counts.warning > 0 ? 'size-3.5 text-warn' : 'size-3.5'} />
          {a.counts.warning} {a.counts.warning === 1 ? 'warning' : 'warnings'}
        </span>
      </button>
      {a.micros !== null && a.turboShare !== null ? (
        <>
          <span className="inline-flex items-center gap-1" title={`Estimated cost: ${a.cost} units per agent per tick`}>
            <Gauge className="size-3.5" />
            <span className="tabular font-mono">{a.micros.toFixed(2)} µs</span> per tick
          </span>
          <span className="inline-flex items-center gap-1" title="Turbo speed compared with the built-in reward">
            <Zap className="size-3.5" />
            Turbo <span className="tabular font-mono">{Math.round(a.turboShare * 100)}%</span>
          </span>
        </>
      ) : (
        <span>Cost shows once the script has no errors</span>
      )}
    </div>
  );
}
