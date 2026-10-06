'use client';

import { ChevronRight, Plus } from 'lucide-react';
import type { RegistryEntry } from '@/engine/script';
import { Button } from '@/ui/primitives/Button';
import { insertExample } from '../../state/docActions';
import { signatureOf, tiersOf, unitsOf, whereUsable } from '../../reference/entryDocs';

/** Where an entry's example goes when inserted as a block. Entries that work anywhere default to each tick. */
function insertScope(e: RegistryEntry): 'tick' | 'generation' {
  return e.scope === 'generation' ? 'generation' : 'tick';
}

/**
 * One registry entry, folded to its name and summary. Native details and
 * summary elements give keyboard and screen reader support for free.
 */
export function ReferenceEntry({ entry, readonly }: { entry: RegistryEntry; readonly: boolean }) {
  return (
    <details className="group rounded-md border border-border bg-surface-2 open:border-border-strong">
      <summary className="flex cursor-pointer list-none items-start gap-2 px-2.5 py-2 [&::-webkit-details-marker]:hidden">
        <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-subtle transition-transform group-open:rotate-90" />
        <span className="flex min-w-0 flex-col">
          <code className="font-mono text-[12px] text-fg">{entry.name}</code>
          <span className="text-[12px] text-muted">{entry.summary}</span>
        </span>
      </summary>
      <div className="flex flex-col gap-2 border-t border-border px-2.5 py-2 text-[12px] leading-relaxed">
        <code className="rounded bg-bg px-2 py-1 font-mono text-[12px] break-words text-accent">{signatureOf(entry)}</code>
        <p className="text-fg">{entry.description}</p>
        <p className="text-muted">
          {unitsOf(entry)} {whereUsable(entry)}
        </p>
        <pre className="overflow-x-auto rounded border border-border bg-bg px-2 py-1.5 font-mono text-[12px] text-fg">{entry.example}</pre>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-subtle">{tiersOf(entry)}</span>
          <Button size="sm" variant="outline" disabled={readonly} onClick={() => insertExample(entry.example, insertScope(entry))} aria-label={`Insert example for ${entry.name}`}>
            <Plus />
            Insert example
          </Button>
        </div>
      </div>
    </details>
  );
}
