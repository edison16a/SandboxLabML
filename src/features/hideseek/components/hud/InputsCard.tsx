'use client';

import { HIDESEEK_OUTPUTS } from '@/engine/hideseek/sensing/inputSchema';
import { InputBars } from '@/features/inputs/InputBars';
import { useInspectReader, useTeamSchemas } from '../../hooks/useTeamSchema';
import { useHideSeekLab } from '../../state/hideSeekStore';

/** The inspected agent's non-ray inputs and its outputs, floating over the viewport while the overlay is on. */
export function InputsCard() {
  const on = useHideSeekLab((s) => s.inputsOverlay && !s.photoMode);
  const agent = useHideSeekLab((s) => s.inspectAgent);
  const hovered = useHideSeekLab((s) => s.hoveredInput);
  const set = useHideSeekLab((s) => s.set);
  const schemas = useTeamSchemas();
  const read = useInspectReader(agent);
  if (!on) return null;
  return (
    <div className="w-72 rounded-lg border border-white/10 bg-black/60 p-2 text-white backdrop-blur-md">
      <div className="mb-1 flex items-center gap-1.5 px-1.5 text-[11px] font-semibold tracking-wide text-white/60 uppercase">
        <span className={`size-2 rounded-full ${agent === 0 ? 'bg-hider' : 'bg-seeker'}`} />
        {agent === 0 ? 'Hider' : 'Seeker'} inputs
      </div>
      <InputBars schema={schemas[agent]} outputs={HIDESEEK_OUTPUTS} read={read} hovered={hovered} onHover={(i) => set({ hoveredInput: i })} compact />
    </div>
  );
}
