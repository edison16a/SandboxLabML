'use client';

import { useCallback } from 'react';
import { RACING_OUTPUTS } from '@/engine/racing/sensors/inputSchema';
import { useRunSchema } from '../hooks/useRunSchema';
import { InputBars } from '@/features/inputs/InputBars';
import { racingSession } from '../session/RacingSession';
import { followsGhost, useRacingLab } from '../state/labStore';

/** Non-ray inputs and the outputs of the followed car, floating over the viewport while the overlay is on. */
export function InputsCard() {
  const on = useRacingLab((s) => s.inputsOverlay);
  const hovered = useRacingLab((s) => s.hoveredInput);
  const ghost = useRacingLab(followsGhost);
  const set = useRacingLab((s) => s.set);
  const schema = useRunSchema();
  const read = useCallback(() => {
    const streams = racingSession().streams;
    return (ghost ? streams?.ghosts : streams?.population)?.inspect ?? null;
  }, [ghost]);
  if (!on) return null;
  return (
    <div className="absolute bottom-3 left-3 w-72 rounded-lg border border-white/10 bg-black/60 p-2 text-white backdrop-blur-md">
      <div className="mb-1 px-1.5 text-[11px] font-semibold tracking-wide text-white/60 uppercase">Followed car</div>
      <InputBars schema={schema} outputs={RACING_OUTPUTS} read={read} hovered={hovered} onHover={(i) => set({ hoveredInput: i })} compact />
    </div>
  );
}
