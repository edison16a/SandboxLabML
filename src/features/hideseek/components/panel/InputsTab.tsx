'use client';

import { useMemo, useState } from 'react';
import { HIDESEEK_OUTPUTS } from '@/engine/hideseek/sensing/inputSchema';
import { hideSeekBlueprints } from '@/engine/training/hideseekRunConfig';
import { InputBars } from '@/features/inputs/InputBars';
import { Button } from '@/ui/primitives/Button';
import { Segmented } from '@/ui/primitives/Segmented';
import { Switch } from '@/ui/primitives/Switch';
import { inspectedArena } from '../../hooks/useHideSeekInspect';
import { useInspectReader, useTeamSchemas } from '../../hooks/useTeamSchema';
import { hideSeekSession } from '../../session/HideSeekSession';
import { useHideSeekLab } from '../../state/hideSeekStore';
import { TeamToggle } from './TeamToggle';

/**
 * Everything one agent of the inspected arena senses right now, with the
 * overlay settings. In the Sandbox, clicking an input lesions it: switched
 * off (forced to 0) or frozen at its current reading, while the brain
 * keeps acting on what is left.
 */
export function InputsTab() {
  const run = useHideSeekLab((s) => s.run);
  const overlay = useHideSeekLab((s) => s.inputsOverlay);
  const scope = useHideSeekLab((s) => s.inputsScope);
  const hovered = useHideSeekLab((s) => s.hoveredInput);
  const agent = useHideSeekLab((s) => s.inspectAgent);
  const focus = useHideSeekLab((s) => s.focus);
  const mode = useHideSeekLab((s) => s.mode);
  const lesions = useHideSeekLab((s) => s.sandbox.lesions);
  const set = useHideSeekLab((s) => s.set);
  const [lesionKind, setLesionKind] = useState<'off' | 'freeze'>('off');
  const schemas = useTeamSchemas();
  const read = useInspectReader(agent);
  const sandbox = mode === 'sandbox';
  const lesioned = useMemo(() => new Set(lesions.filter((l) => l.agent === agent).map((l) => l.index)), [lesions, agent]);
  const toggle = (index: number) => {
    const control = hideSeekSession().sandbox;
    if (!control) return;
    if (lesioned.has(index)) return control.setLesion(agent, index, null);
    control.setLesion(agent, index, lesionKind === 'off' ? 0 : (read()?.obs[index] ?? 0));
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <TeamToggle value={agent} onChange={(v) => set({ inspectAgent: v })} />
        <span className="text-[12px] text-muted">Arena {inspectedArena(focus) + 1}</span>
      </div>
      <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-2 p-3">
        <label className="flex items-center justify-between text-[13px]">
          Draw inputs in the viewport
          <Switch label="Inputs overlay" checked={overlay} onChange={(v) => set({ inputsOverlay: v })} />
        </label>
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-muted">Show rays for</span>
          <Segmented
            label="Overlay scope"
            size="sm"
            value={scope}
            onChange={(v) => set({ inputsScope: v })}
            options={[
              { value: 'focused', label: 'Inspected agent' },
              { value: 'all', label: 'Every arena' },
            ]}
          />
        </div>
      </div>
      {sandbox && (
        <div className="flex flex-col gap-2 rounded-md border border-warn/30 bg-warn/5 p-3 text-[12px]">
          <div className="flex items-center justify-between">
            <span className="font-medium text-fg">Lesion test</span>
            <Segmented
              label="Lesion kind"
              size="sm"
              value={lesionKind}
              onChange={setLesionKind}
              options={[
                { value: 'off', label: 'Switch off' },
                { value: 'freeze', label: 'Freeze' },
              ]}
            />
          </div>
          <p className="text-muted">Click an input name to {lesionKind === 'off' ? 'force it to 0' : 'hold it at its current reading'}. The brain keeps acting; affected links turn amber in the Network tab.</p>
          {lesioned.size > 0 && (
            <Button size="sm" variant="outline" className="self-start" onClick={() => hideSeekSession().sandbox?.clearLesions()}>
              Clear {lesions.length} lesion{lesions.length === 1 ? '' : 's'}
            </Button>
          )}
        </div>
      )}
      <p className="text-[12px] text-muted">
        {schemas[agent].length} inputs from the <span className="text-fg">{run?.env === 'hideseek' ? hideSeekBlueprints(run)[agent === 0 ? 'hider' : 'seeker'].name : ''}</span> blueprint. Hover a row to highlight that sensor in 3D and in the network.
      </p>
      <InputBars
        schema={schemas[agent]}
        outputs={HIDESEEK_OUTPUTS}
        read={read}
        hovered={hovered}
        onHover={(i) => set({ hoveredInput: i })}
        lesioned={sandbox ? lesioned : undefined}
        onToggleLesion={sandbox ? toggle : undefined}
      />
    </div>
  );
}
