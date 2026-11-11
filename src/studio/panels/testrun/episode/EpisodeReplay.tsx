'use client';

import { useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import type { EpisodePreview } from '@/engine/lessons/preview/types';
import { Button } from '@/ui/primitives/Button';
import { Slider } from '@/ui/primitives/Slider';
import { previewDrawer } from '../../learn/preview/episode/drawers';
import { usePlayback } from '../../learn/preview/usePlayback';

/** How often the scrubber follows the playhead while it plays, ms. The canvas itself redraws every frame without React. */
const FOLLOW_MS = 120;

/**
 * The test episode replayed from above at real time, with play, restart
 * and a scrubber to go to any tick. It draws with the env's lesson preview
 * drawer, so a Driving test run shows the streets, the lights, the traffic
 * and the SUV exactly as the lesson preview does.
 */
export function EpisodeReplay({ preview }: { preview: EpisodePreview }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const { playing, toggle, restart, seek, position } = usePlayback(preview, canvas, readout);
  const [tick, setTick] = useState(0);
  const drawer = previewDrawer(preview.env);
  const last = Math.max(0, preview.ticks - 1);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => setTick(Math.min(last, Math.round(position()))), FOLLOW_MS);
    return () => clearInterval(id);
  }, [playing, position, last]);

  return (
    <div className="flex flex-col gap-2">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-md border border-border bg-bg">
        <canvas ref={canvas} className="absolute inset-0 h-full w-full" role="img" aria-label={drawer.label} />
        <span ref={readout} className="tabular pointer-events-none absolute bottom-1.5 left-1.5 rounded bg-bg/80 px-1.5 py-0.5 font-mono text-[11px] text-muted empty:hidden" aria-hidden="true" />
      </div>
      <div className="flex items-center gap-2">
        <Button size="icon-sm" variant="ghost" onClick={toggle} aria-label={playing ? 'Pause the replay' : 'Play the replay'} title={playing ? 'Pause' : 'Play'}>
          {playing ? <Pause /> : <Play />}
        </Button>
        <Button
          size="icon-sm"
          variant="ghost"
          onClick={() => {
            restart();
            setTick(0);
          }}
          aria-label="Replay from the start"
          title="Restart"
        >
          <RotateCcw />
        </Button>
        <Slider
          label="Replay position"
          min={0}
          max={last}
          value={tick}
          disabled={last === 0}
          onChange={(t) => {
            setTick(t);
            seek(t);
          }}
        />
      </div>
      <p className="text-[11px] text-subtle">{drawer.caption}</p>
    </div>
  );
}
