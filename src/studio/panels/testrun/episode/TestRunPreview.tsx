'use client';

import { useRef } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { EpisodePreview } from '@/engine/lessons/preview/types';
import { Button } from '@/ui/primitives/Button';
import { previewDrawer } from '../../learn/preview/episode/drawers';
import { usePlayback } from '../../learn/preview/usePlayback';

/**
 * The test episode from above, replayed at real time with the env's
 * lesson preview drawer: the scene, the agent's trail, its rays and the
 * readout at the playhead. It loops, and can be paused or restarted.
 */
export function TestRunPreview({ preview }: { preview: EpisodePreview }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const { playing, toggle, restart } = usePlayback(preview, canvas, readout);
  const drawer = previewDrawer(preview.env);
  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative aspect-[16/9] w-full overflow-hidden rounded-md border border-border bg-bg">
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" role="img" aria-label={drawer.label} />
      </div>
      <div className="flex items-center gap-1">
        <Button size="icon-sm" variant="ghost" onClick={toggle} aria-label={playing ? 'Pause the replay' : 'Play the replay'} title={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button size="icon-sm" variant="ghost" onClick={restart} aria-label="Replay from the start" title="Restart">
          <RotateCcw />
        </Button>
        <span ref={readout} className="tabular ml-1 min-w-0 truncate font-mono text-[11px] text-muted" aria-hidden="true" />
      </div>
    </div>
  );
}
