'use client';

import dynamic from 'next/dynamic';
import { Lock } from 'lucide-react';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/Button';
import { duplicate } from '../state/scriptActions';
import { useStudio } from '../state/studioStore';
import { EditorToolbar } from './EditorToolbar';
import { StatusLine } from './StatusLine';

function Loading({ what }: { what: string }) {
  return <div className="flex h-full items-center justify-center text-[13px] text-muted">Loading the {what}...</div>;
}

/** CodeMirror is the largest dependency on this route, so it only downloads when the code view first shows. */
const CodeEditor = dynamic(() => import('../code/CodeEditor'), { ssr: false, loading: () => <Loading what="code editor" /> });
const BlocksView = dynamic(() => import('../blocks/BlocksView'), { ssr: false, loading: () => <Loading what="blocks" /> });

/** The center column: toolbar, one of the two views of the open script, and the status line. */
export function EditorPane({ className }: { className?: string }) {
  const mode = useStudio((s) => s.mode);
  const script = useStudio((s) => s.script);
  return (
    <section className={cn('flex min-h-0 min-w-0 flex-col bg-bg', className)} aria-label="Editor">
      <EditorToolbar />
      {script?.readonly && mode === 'code' && (
        <div className="flex shrink-0 items-center gap-2 border-b border-border bg-surface px-3 py-1.5 text-[12px] text-muted">
          <Lock className="size-3.5" />
          This preset is read only.
          <Button size="sm" variant="outline" className="ml-auto" onClick={() => void duplicate(script.id)}>
            Duplicate to edit
          </Button>
        </div>
      )}
      <div className="min-h-0 flex-1">{script ? mode === 'code' ? <CodeEditor /> : <BlocksView /> : <Loading what="script" />}</div>
      <StatusLine />
    </section>
  );
}
