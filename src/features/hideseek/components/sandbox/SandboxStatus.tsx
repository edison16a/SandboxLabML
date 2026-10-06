'use client';

import { useSandboxPulse } from './useSandboxPulse';

/**
 * One line on how the match stands: the prep countdown, then the seek
 * clock and how many hiders are in sight, then the final count.
 */
export function SandboxStatus() {
  const p = useSandboxPulse();
  if (!p.hiders) return null;
  const seen = `${p.hidersSeen} of ${p.hiders} seen`;
  const text = p.over ? `Match over, ${seen}` : p.prep ? `Prep, ${p.time.toFixed(1)} s` : `Seeking, ${p.time.toFixed(1)} s`;
  return (
    <span role="status" className="flex items-center gap-2 text-[11px] text-white/70">
      {!p.prep && !p.over && (
        <span className={`rounded px-1.5 py-px font-medium ${p.hidersSeen ? 'bg-seeker/25 text-[#ffb3ba]' : 'bg-hider/20 text-[#a9cdff]'}`}>
          {p.hidersSeen ? seen : 'All hidden'}
        </span>
      )}
      <span className="tabular">{text}</span>
    </span>
  );
}
