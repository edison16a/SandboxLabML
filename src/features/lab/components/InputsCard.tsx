'use client';

import { useCallback } from 'react';
import { InputBars } from '@/features/inputs/InputBars';
import { useRunSchema } from '../hooks/useRunSchema';
import { useLab, useLabContext, useLabSet } from '../LabContext';
import { followsGhost } from '../state/labState';

/** Non ray inputs and the outputs of the followed agent, floating over the viewport while the overlay is on. */
export function InputsCard() {
  const { module, session, agentNoun } = useLabContext();
  const on = useLab((s) => s.inputsOverlay);
  const hovered = useLab((s) => s.hoveredInput);
  const ghost = useLab(followsGhost);
  const set = useLabSet();
  const schema = useRunSchema();
  const read = useCallback(() => {
    const streams = session.streams;
    return (ghost ? streams?.ghosts : streams?.population)?.inspect ?? null;
  }, [session, ghost]);
  if (!on) return null;
  return (
    <div className="absolute bottom-3 left-3 w-72 rounded-lg border border-white/10 bg-black/60 p-2 text-white backdrop-blur-md">
      <div className="mb-1 px-1.5 text-[11px] font-semibold tracking-wide text-white/60 uppercase">Followed {agentNoun}</div>
      <InputBars schema={schema} outputs={module.outputs} read={read} hovered={hovered} onHover={(i) => set({ hoveredInput: i })} compact />
    </div>
  );
}
