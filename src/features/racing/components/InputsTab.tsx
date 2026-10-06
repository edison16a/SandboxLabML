'use client';

import { useCallback } from 'react';
import { RACING_OUTPUTS } from '@/engine/racing/sensors/inputSchema';
import { useRunSchema } from '../hooks/useRunSchema';
import { InputBars } from '@/features/inputs/InputBars';
import { Segmented } from '@/ui/primitives/Segmented';
import { Switch } from '@/ui/primitives/Switch';
import { racingSession } from '../session/RacingSession';
import { followsGhost, useRacingLab } from '../state/labStore';

/** Everything the followed car senses right now, plus overlay settings. */
export function InputsTab() {
  const run = useRacingLab((s) => s.run);
  const overlay = useRacingLab((s) => s.inputsOverlay);
  const scope = useRacingLab((s) => s.inputsScope);
  const hovered = useRacingLab((s) => s.hoveredInput);
  const set = useRacingLab((s) => s.set);
  const mode = useRacingLab((s) => s.mode);
  const lesions = useRacingLab((s) => s.lesions);
  const lesioned = new Set(Object.keys(lesions).map(Number));
  const toggleLesion = (i: number) => {
    const next = { ...lesions };
    if (i in next) delete next[i];
    else next[i] = 0;
    set({ lesions: next });
    racingSession().sandboxChanged();
  };
  const schema = useRunSchema();
  const ghost = useRacingLab(followsGhost);
  const read = useCallback(() => {
    const streams = racingSession().streams;
    const stream = ghost ? streams?.ghosts : streams?.population;
    return stream?.inspect ?? null;
  }, [ghost]);

  return (
    <div className="flex flex-col gap-4 p-4">
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
              { value: 'selected', label: 'Followed car' },
              { value: 'all', label: 'All cars' },
            ]}
          />
        </div>
      </div>
      {mode === 'sandbox' && (
        <p className="rounded-md border border-orange/30 bg-orange-soft px-3 py-2 text-[12px] text-orange">
          Lesion test: click an input name to switch it off. The brain keeps acting without it, so you can see what it relies on. Training is never affected.
        </p>
      )}
      <p className="text-[12px] text-muted">
        {schema.length} inputs from the <span className="text-fg">{run?.blueprint.name}</span> blueprint. Hover a row to highlight that sensor in 3D and in the network.
      </p>
      <InputBars
        schema={schema}
        outputs={RACING_OUTPUTS}
        read={read}
        hovered={hovered}
        onHover={(i) => set({ hoveredInput: i })}
        lesioned={lesioned}
        onToggleLesion={mode === 'sandbox' ? toggleLesion : undefined}
      />
    </div>
  );
}
