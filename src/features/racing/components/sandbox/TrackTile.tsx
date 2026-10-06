'use client';

import type { ReactNode } from 'react';
import { X } from 'lucide-react';
import type { TrackSpec } from '@/engine/racing/track/types';
import { cn } from '@/ui/cn';
import { TrackThumb } from '../TrackThumb';

interface Props {
  label: string;
  selected: boolean;
  onSelect: () => void;
  /** Drawn as an outline. Tiles that are actions, such as Random, show an icon instead. */
  spec?: TrackSpec;
  icon?: ReactNode;
  /** A word in the corner, e.g. "Trained" on the track the run learned on. */
  tag?: string;
  onRemove?: () => void;
}

/** One entry in the Sandbox track gallery. */
export function TrackTile({ label, selected, onSelect, spec, icon, tag, onRemove }: Props) {
  return (
    <div className="group relative">
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        title={label}
        className={cn(
          'flex w-full flex-col items-center gap-1 rounded-md border px-1 pt-2 pb-1 text-[11px] transition-colors',
          selected ? 'border-accent/70 bg-accent/15 text-white' : 'border-white/10 bg-white/[0.04] text-white/70 hover:border-white/25 hover:text-white',
        )}
      >
        <span className="flex size-10 items-center justify-center [&_svg]:size-5">
          {spec ? <TrackThumb spec={spec} size={40} className={selected ? 'text-accent' : 'text-white/75'} /> : icon}
        </span>
        <span className="w-full truncate text-center leading-tight">{label}</span>
      </button>
      {tag && <span className="pointer-events-none absolute top-0.5 left-0.5 rounded-sm bg-black/55 px-1 text-[9px] leading-[14px] font-medium text-white/75">{tag}</span>}
      {onRemove && (
        // Hidden until hover where there is a mouse; always there on touch screens, which cannot hover.
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Delete ${label}`}
          className="absolute top-0.5 right-0.5 flex size-5 items-center justify-center rounded text-white/60 hover:bg-white/15 hover:text-white focus-visible:opacity-100 pointer-fine:opacity-0 pointer-fine:group-hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      )}
    </div>
  );
}
