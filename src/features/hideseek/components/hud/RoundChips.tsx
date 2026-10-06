'use client';

import { HIDESEEK_LAYOUTS } from '@/engine/hideseek/layouts/presets';
import { cn } from '@/ui/cn';
import { useArenaPulse, usePhaseLeft } from '../../hooks/useArenaPulse';
import { useHideSeekLab } from '../../state/hideSeekStore';

/** One glass chip over the viewport: a small caps label above a value. */
export function Chip({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('flex flex-col rounded-md border border-white/10 bg-black/50 px-2.5 py-1.5 leading-tight backdrop-blur-sm', className)}>
      <span className="text-[10px] font-medium tracking-wide text-white/60 uppercase">{label}</span>
      <span className="tabular font-mono text-[14px] font-semibold text-white">{children}</span>
    </div>
  );
}

/**
 * Top left of the viewport: generation, which round of the generation is
 * on screen (or which one a Turbo replay shows), the phase of the match
 * with its countdown, and the share of hiders out of sight right now.
 */
export function RoundChips() {
  const pulse = useArenaPulse();
  const left = usePhaseLeft(pulse);
  const gen = useHideSeekLab((s) => s.liveGeneration);
  const round = useHideSeekLab((s) => s.round);
  const source = useHideSeekLab((s) => s.source);
  const replayOf = useHideSeekLab((s) => s.replayOf);
  const mode = useHideSeekLab((s) => s.mode);
  const shown = source === 'replay' && replayOf && mode === 'train' ? { ...replayOf, label: 'Replay' } : round ? { ...round, label: 'Round' } : null;
  const share = pulse.seeking > 0 ? Math.round((100 * pulse.hidden) / pulse.seeking) : null;
  return (
    <div className="pointer-events-none flex flex-wrap gap-1.5">
      <Chip label="Generation">{(mode === 'train' && shown ? shown.generation : gen) + 1}</Chip>
      {mode === 'train' && shown && (
        <Chip label={shown.label}>
          {shown.round + 1} of {shown.rounds}
          {round && shown.label === 'Round' && <span className="ml-1.5 font-sans text-[11px] font-normal text-white/60">{HIDESEEK_LAYOUTS[round.layout].name}</span>}
        </Chip>
      )}
      {pulse.arenas > 0 && (
        <Chip label={pulse.prep ? 'Prep' : 'Seek'} className={pulse.prep ? '' : 'border-seeker/30'}>
          {left.toFixed(1)} s
        </Chip>
      )}
      {pulse.arenas > 0 && (
        <Chip label="Hidden now" className={share !== null && share >= 50 ? 'border-hider/40' : ''}>
          {share === null ? 'prep' : `${share}%`}
          {share !== null && mode === 'train' && <span className="ml-1.5 font-sans text-[11px] font-normal text-white/60">{pulse.hidden} of {pulse.seeking}</span>}
        </Chip>
      )}
    </div>
  );
}
