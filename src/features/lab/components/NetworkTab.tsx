'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { BrainStats } from '@/features/network/BrainStats';
import { NetworkCanvas } from '@/features/network/NetworkCanvas';
import { Button } from '@/ui/primitives/Button';
import { Slider } from '@/ui/primitives/Slider';
import { Switch } from '@/ui/primitives/Switch';
import { useRunSchema } from '../hooks/useRunSchema';
import { useLab, useLabContext, useLabSet } from '../LabContext';
import { followsGhost } from '../state/labState';

/**
 * The champion's brain. The slider scrubs through generations so you can
 * watch the network grow; with an agent followed, its live sensor readings
 * run through the network and light up the links that carry the decision.
 */
export function NetworkTab() {
  const { api, module, session } = useLabContext();
  const records = useLab((s) => s.records);
  const focus = useLab((s) => s.focus);
  const ghost = useLab(followsGhost);
  const pinned = useLab((s) => s.networkGeneration);
  const hoveredInput = useLab((s) => s.hoveredInput);
  const set = useLabSet();
  const [showDisabled, setShowDisabled] = useState(false);
  const lesions = useLab((s) => s.lesions);
  const lesioned = useMemo(() => new Set(Object.keys(lesions).map(Number)), [lesions]);
  const [playing, setPlaying] = useState(false);

  // In the Sandbox the camera follows the copy on pole, the last champion in the stream.
  const poleGen = useLab((s) => (s.mode === 'sandbox' ? s.ghostGenerations[s.ghostGenerations.length - 1] : undefined));
  const followGen = focus.kind === 'ghost' ? focus.generation : (poleGen ?? records.length - 1);
  const gen = pinned ?? followGen;
  const outside = useLab((s) => (s.mode === 'sandbox' ? (s.sandboxBrain ?? null) : null));
  const stored = records.find((r) => r.generation === gen) ?? records[records.length - 1];
  // A brain the Sandbox drives from outside the run is shown on its own, without the growth slider.
  const record = outside ? { genome: outside.genome, generation: -1 } : stored;
  const schema = useRunSchema();
  const labels = useMemo(() => schema.map((s) => s.label), [schema]);
  const outputLabels = useMemo(() => module.outputs.map((o) => o.label), [module]);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      const s = api.getState();
      const next = (s.networkGeneration ?? -1) + 1;
      if (next >= s.records.length) setPlaying(false);
      else api.setState({ networkGeneration: next });
    }, 350);
    return () => clearInterval(id);
  }, [api, playing]);

  const live = useCallback(() => {
    const streams = session.streams;
    if (!streams) return null;
    const stream = ghost ? streams.ghosts : streams.population;
    return stream.inspect?.obs ?? null;
  }, [session, ghost]);

  if (!record) return <div className="p-4 text-[13px] text-muted">Appears after the first generation.</div>;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-4 border-b border-border px-4 py-3 text-[12px]">
        <BrainStats genome={record.genome} />
        <label className="ml-auto flex items-center gap-2 text-muted">
          Disabled
          <Switch label="Show disabled links" checked={showDisabled} onChange={setShowDisabled} />
        </label>
      </div>
      <div className="min-h-0 flex-1 px-1 py-2">
        <NetworkCanvas
          genome={record.genome}
          inputLabels={labels}
          outputLabels={outputLabels}
          liveObservation={live}
          hoveredInput={hoveredInput}
          onHoverInput={(i) => set({ hoveredInput: i })}
          showDisabled={showDisabled}
          lesioned={lesioned}
        />
      </div>
      {outside && <div className="border-t border-border px-4 py-3 text-[12px] text-muted">{outside.label}</div>}
      <div className={outside ? 'hidden' : 'flex flex-col gap-2 border-t border-border px-4 py-3'}>
        <div className="flex items-center justify-between text-[12px] text-muted">
          <span>
            Generation <span className="font-mono text-fg">{record.generation + 1}</span> champion
          </span>
          {pinned !== null && (
            <button className="text-accent hover:underline" onClick={() => set({ networkGeneration: null })}>
              Follow latest
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button size="icon-sm" variant="outline" aria-label={playing ? 'Pause growth playback' : 'Play growth'} onClick={() => {
            if (!playing && (pinned === null || pinned >= records.length - 1)) set({ networkGeneration: 0 });
            setPlaying(!playing);
          }}>
            {playing ? <Pause /> : <Play />}
          </Button>
          <Slider label="Generation" min={0} max={Math.max(0, records.length - 1)} value={record.generation} onChange={(v) => set({ networkGeneration: v })} />
        </div>
      </div>
    </div>
  );
}
