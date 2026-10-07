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
  className?: string;
}

/**
 * The live brain card in the hero's corner: whose brain it is, how big it
 * is, and the graph lighting up as it decides. A flat blurred panel keeps
 * it readable over either scene without any glow.
 */
export function BrainPanel({ title, dot, genome, outputLabels, stream, inspect, className }: Props) {
  const counts = useMemo(() => countGenome(genome), [genome]);
  return (
    <div className={cn(CARD, 'flex w-[264px] flex-col gap-2 p-3 xl:w-[300px] 2xl:w-[340px]', className)}>
      <div className="flex items-center gap-2 text-[12px]">
        <span className={cn('size-2 rounded-full', dot)} />
        <span className="font-medium text-fg">{title}</span>
        <span className="ml-auto font-mono text-[11px] text-muted tabular">
          {counts.inputs} in, {counts.hidden} hidden, {counts.enabled} links
        </span>
      </div>
      <div className="h-[140px] 2xl:h-[168px]">
        <BrainGraph genome={genome} outputLabels={outputLabels} stream={stream} inspect={inspect} />
      </div>
    </div>
  );
}
