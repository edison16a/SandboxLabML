'use client';

import { useCallback, useMemo, useState } from 'react';
import { countGenome } from '@/engine/neat/genome';
import { HIDESEEK_OUTPUTS } from '@/engine/hideseek/sensing/inputSchema';
import { NetworkCanvas } from '@/features/network/NetworkCanvas';
import { Slider } from '@/ui/primitives/Slider';
import { Switch } from '@/ui/primitives/Switch';
import { useInspectReader, useTeamSchemas } from '../../hooks/useTeamSchema';
import { useHideSeekLab } from '../../state/hideSeekStore';
import { TeamToggle } from './TeamToggle';

/**
 * The champion brain of either team. The slider scrubs generations; the
 * inspected agent's live inputs run through it so the links carrying the
 * current decision light up. In the Sandbox it shows the brains on the
 * field, with lesioned inputs and their links in amber.
 */
export function NetworkTab() {
  const records = useHideSeekLab((s) => s.records);
  const agent = useHideSeekLab((s) => s.inspectAgent);
  const pinned = useHideSeekLab((s) => s.networkGeneration);
  const hovered = useHideSeekLab((s) => s.hoveredInput);
  const mode = useHideSeekLab((s) => s.mode);
  const sandbox = useHideSeekLab((s) => s.sandbox);
  const set = useHideSeekLab((s) => s.set);
  const [showDisabled, setShowDisabled] = useState(false);
  const schemas = useTeamSchemas();
  const read = useInspectReader(agent);
  const live = useCallback(() => read()?.obs ?? null, [read]);
  const sandboxGen = agent === 0 ? sandbox.hiderGeneration : sandbox.seekerGeneration;
  const gen = mode === 'sandbox' ? sandboxGen : pinned;
  const record = (gen !== null ? records.find((r) => r.generation === gen) : undefined) ?? records[records.length - 1];
  const labels = useMemo(() => schemas[agent].map((s) => s.label), [schemas, agent]);
  const lesioned = useMemo(() => (mode === 'sandbox' ? new Set(sandbox.lesions.filter((l) => l.agent === agent).map((l) => l.index)) : undefined), [mode, sandbox.lesions, agent]);

  if (!record) return <div className="p-4 text-[13px] text-muted">Appears after the first generation.</div>;
  const genome = agent === 0 ? record.hiderChampion : record.seekerChampion;
  const counts = countGenome(genome);
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border px-4 py-3 text-[12px]">
        <TeamToggle value={agent} onChange={(v) => set({ inspectAgent: v })} />
        <span className="text-muted">
          <span className="font-mono text-fg">{counts.hidden}</span> hidden
        </span>
        <span className="text-muted">
          <span className="font-mono text-fg">{counts.enabled}</span> links
        </span>
        <label className="ml-auto flex items-center gap-2 text-muted">
          Disabled
          <Switch label="Show disabled links" checked={showDisabled} onChange={setShowDisabled} />
        </label>
      </div>
      <div className="min-h-0 flex-1 px-1 py-2">
        <NetworkCanvas
          genome={genome}
          inputLabels={labels}
          outputLabels={HIDESEEK_OUTPUTS.map((o) => o.label)}
          liveObservation={live}
          hoveredInput={hovered}
          onHoverInput={(i) => set({ hoveredInput: i })}
          showDisabled={showDisabled}
          lesioned={lesioned}
        />
      </div>
      <div className="flex flex-col gap-2 border-t border-border px-4 py-3">
        <div className="flex items-center justify-between text-[12px] text-muted">
          <span>
            Generation <span className="font-mono text-fg">{record.generation + 1}</span> {agent === 0 ? 'hider' : 'seeker'} champion
          </span>
          {mode === 'train' && pinned !== null && (
            <button className="text-accent hover:underline" onClick={() => set({ networkGeneration: null })}>
              Follow latest
            </button>
          )}
        </div>
        {mode === 'train' && (
          <Slider label="Generation" min={0} max={Math.max(0, records.length - 1)} value={records.indexOf(record)} onChange={(v) => set({ networkGeneration: records[v]?.generation ?? null })} />
        )}
      </div>
    </div>
  );
}
