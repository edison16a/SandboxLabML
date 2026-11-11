'use client';

import { useCallback } from 'react';
import { InputBars } from '@/features/inputs/InputBars';
import { Segmented } from '@/ui/primitives/Segmented';
import { Switch } from '@/ui/primitives/Switch';
import { useViewSchema } from '../hooks/useRunSchema';
import { useLab, useLabContext, useLabSet } from '../LabContext';
import { followsGhost } from '../state/labState';

/**
 * Everything the followed agent senses right now, plus overlay settings.
 * `allScope` offers drawing every agent's rays; a lab that only draws the
 * followed agent's sensors turns it off.
 */
export function InputsTab({ allScope = true }: { allScope?: boolean }) {
  const { module, session, agentNoun } = useLabContext();
  const run = useLab((s) => s.run);
  const overlay = useLab((s) => s.inputsOverlay);
  const scope = useLab((s) => s.inputsScope);
  const hovered = useLab((s) => s.hoveredInput);
  const set = useLabSet();
  const mode = useLab((s) => s.mode);
  const lesions = useLab((s) => s.lesions);
  const lesioned = new Set(Object.keys(lesions).map(Number));
  const toggleLesion = (i: number) => {
    const next = { ...lesions };
    if (i in next) delete next[i];
    else next[i] = 0;
    set({ lesions: next });
    session.sandboxChanged();
  };
  const schema = useViewSchema();
  const ghost = useLab(followsGhost);
  const read = useCallback(() => {
    const streams = session.streams;
    const stream = ghost ? streams?.ghosts : streams?.population;
    return stream?.inspect ?? null;
  }, [session, ghost]);

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-col gap-3 rounded-md border border-border bg-surface-2 p-3">
        <label className="flex items-center justify-between text-[13px]">
          Draw inputs in the viewport
          <Switch label="Inputs overlay" checked={overlay} onChange={(v) => set({ inputsOverlay: v })} />
        </label>
        {allScope && (
          <div className="flex items-center justify-between text-[13px]">
            <span className="text-muted">Show rays for</span>
            <Segmented
              label="Overlay scope"
              size="sm"
              value={scope}
              onChange={(v) => set({ inputsScope: v })}
              options={[
                { value: 'selected', label: `Followed ${agentNoun}` },
                { value: 'all', label: `All ${agentNoun}s` },
              ]}
            />
          </div>
        )}
      </div>
      {mode === 'sandbox' && (
        <p className="rounded-md border border-orange/30 bg-orange-soft px-3 py-2 text-[12px] text-orange">
          Lesion test: click an input to switch it off and see what the brain relies on.
        </p>
      )}
      <p className="text-[12px] text-muted">
        {schema.length} inputs, <span className="text-fg">{run?.blueprint.name}</span> blueprint
      </p>
      <InputBars
        schema={schema}
        outputs={module.outputs}
        read={read}
        hovered={hovered}
        onHover={(i) => set({ hoveredInput: i })}
        lesioned={lesioned}
        onToggleLesion={mode === 'sandbox' ? toggleLesion : undefined}
      />
    </div>
  );
}
