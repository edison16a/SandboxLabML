'use client';

import { countGenome } from '@/engine/neat/genome';
import { hiddenDepth } from '@/engine/neat/depth';
import type { Genome } from '@/engine/neat/types';
import { Tooltip } from '@/ui/primitives/Tooltip';

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span className="text-muted">
      <span className="font-mono text-fg">{value}</span> {label}
    </span>
  );
}

/**
 * The size of a brain in one row: hidden neurons, how many layers deep
 * they go, and enabled links. Training adds neurons and layers by itself,
 * which the tooltip says, since a brain that starts with none looks like
 * it can never get deep.
 */
export function BrainStats({ genome }: { genome: Genome }) {
  const counts = countGenome(genome);
  const layers = hiddenDepth(genome);
  return (
    <>
      <Stat value={counts.hidden} label="hidden" />
      <Tooltip content="Hidden layers on the longest path. Training adds neurons and layers as the brain needs them.">
        <span tabIndex={0}>
          <Stat value={layers} label={layers === 1 ? 'layer' : 'layers'} />
        </span>
      </Tooltip>
      <Stat value={counts.enabled} label="links" />
    </>
  );
}
