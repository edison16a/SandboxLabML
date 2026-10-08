'use client';

import { useMemo } from 'react';
import { countGenome } from '@/engine/neat/genome';
import type { Genome } from '@/engine/neat/types';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { cn } from '@/ui/cn';
import { BrainGraph } from './BrainGraph';
import { CARD } from './card';

interface Props {
  title: string;
  /** Tailwind background class for the dot next to the title, the agent's own color. */
  dot: string;
  genome: Genome;
  outputLabels: readonly string[];
  stream: SnapshotStream;
  inspect: number;
  /** What is happening, in a word or two, beside the live dot. */
  status: string;
  /** Real numbers from the run or the match clock, on the right of the status line. */
  detail: string;
  className?: string;
}

/**
 * A live brain card in the hero's corner: whose brain it is, how big it
 * is, the graph lighting up as it decides, and a status line with real
 * numbers. A flat blurred panel keeps it readable over either scene
 * without any glow.
 */
export function BrainPanel({ title, dot, genome, outputLabels, stream, inspect, status, detail, className }: Props) {
  const counts = useMemo(() => countGenome(genome), [genome]);
  return (
    <div className={cn(CARD, 'flex w-[240px] flex-col gap-2 p-3 xl:w-[300px] 2xl:w-[340px]', className)}>
      <div className="flex items-center gap-2 text-[12px]">
        <span className={cn('size-2 shrink-0 rounded-full', dot)} />
        <span className="font-medium whitespace-nowrap text-fg">{title}</span>
        {/* The narrow card of a small laptop leaves out the hidden count, so the header stays on one line. */}
        <span className="ml-auto font-mono text-[11px] whitespace-nowrap text-muted tabular">
          {counts.inputs} in<span className="max-xl:hidden">, {counts.hidden} hidden</span>, {counts.enabled} links
        </span>
      </div>
      <div className="h-[112px] xl:h-[128px] 2xl:h-[160px]">
        <BrainGraph genome={genome} outputLabels={outputLabels} stream={stream} inspect={inspect} />
      </div>
      <div className="flex items-center gap-2 border-t border-white/10 pt-2 text-[12px]">
        <span className="size-1.5 shrink-0 rounded-full bg-success" />
        <span className="whitespace-nowrap text-fg">{status}</span>
        <span className="ml-auto font-mono text-[11px] whitespace-nowrap text-muted tabular">{detail}</span>
      </div>
    </div>
  );
}
