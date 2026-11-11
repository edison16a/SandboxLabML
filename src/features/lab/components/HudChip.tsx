'use client';

/**
 * One number over the viewport, the way every lab's HUD shows it: a small
 * caps label over a monospaced value on dark glass. `note` sits after the
 * value in a lighter tone, such as a level's name.
 */
export function HudChip({ label, value, note, tour }: { label: string; value: React.ReactNode; note?: string; tour?: string }) {
  return (
    <div data-tour={tour} className="flex flex-col rounded-md border border-white/10 bg-black/45 px-2.5 py-1.5 leading-tight backdrop-blur-sm">
      <span className="text-[10px] font-medium tracking-wide text-white/60 uppercase">{label}</span>
      <span className="flex items-baseline gap-1.5 whitespace-nowrap">
        <span className="tabular font-mono text-[14px] font-semibold text-white">{value}</span>
        {note && <span className="text-[12px] font-medium text-white/65">{note}</span>}
      </span>
    </div>
  );
}
