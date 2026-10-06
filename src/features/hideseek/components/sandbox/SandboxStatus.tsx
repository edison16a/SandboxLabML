'use client';

import type { ArenaPulse } from '../../hooks/useArenaPulse';

/** What screen readers hear: the phase, the seen count and the end. Never the clock, which changes four times a second. */
function announcement(p: ArenaPulse): string {
  if (!p.hiders) return '';
  const seen = `${p.hidersSeen} of ${p.hiders} hiders seen.`;
  if (p.over) return `Match over. ${seen}`;
  return p.prep ? 'Prep. The hiders are hiding.' : `Seek. ${seen}`;
}

/**
 * One line on how the match stands: the prep countdown, then the seek
 * countdown and how many hiders are in sight, then the final count.
 * `left` is the seconds left in the phase, the same as the HUD chip.
 */
export function SandboxStatus({ pulse: p, left }: { pulse: ArenaPulse; left: number }) {
  const seen = `${p.hidersSeen} of ${p.hiders} seen`;
  const text = p.over ? `Match over, ${seen}` : `${p.prep ? 'Prep' : 'Seek'} ${left.toFixed(1)} s left`;
  return (
    <>
      <span role="status" className="sr-only">
        {announcement(p)}
      </span>
      {p.hiders > 0 && (
        <span data-testid="sandbox-status" className="flex items-center gap-2 text-[11px] text-white/70">
          {!p.prep && !p.over && (
            <span className={`rounded px-1.5 py-px font-medium ${p.hidersSeen ? 'bg-seeker/25 text-[#ffb3ba]' : 'bg-hider/20 text-[#a9cdff]'}`}>
              {p.hidersSeen ? seen : 'All hidden'}
            </span>
          )}
          <span className="tabular">{text}</span>
        </span>
      )}
    </>
  );
}
