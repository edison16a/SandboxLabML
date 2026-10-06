'use client';

import { Plus } from 'lucide-react';
import { PRESET_ROOMS, type SandboxRoom } from '@/engine/hideseek/sandbox/room';
import { cn } from '@/ui/cn';
import { RoomThumb } from './RoomThumb';

interface Props {
  rooms: readonly SandboxRoom[];
  value: string;
  onPick: (id: string) => void;
  onNew: () => void;
}

const tile = 'flex flex-col items-center gap-1 rounded-md border p-1 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-accent';

/** Preset rooms, then the user's own, then a tile to draw a new one. The grid scrolls past two rows. */
export function RoomPicker({ rooms, value, onPick, onNew }: Props) {
  const all = [...PRESET_ROOMS, ...rooms];
  return (
    <div role="radiogroup" aria-label="Room" className="grid max-h-[150px] grid-cols-4 gap-1.5 overflow-y-auto pr-0.5">
      {all.map((room) => {
        const on = room.id === value;
        return (
          <button
            key={room.id}
            type="button"
            role="radio"
            aria-checked={on}
            title={room.name}
            onClick={() => onPick(room.id)}
            className={cn(tile, on ? 'border-accent/70 bg-accent/15 text-white' : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/10 hover:text-white')}
          >
            <RoomThumb room={room} size={52} />
            <span className="w-full truncate text-center">{room.name.replace(' room', '')}</span>
          </button>
        );
      })}
      <button type="button" onClick={onNew} className={cn(tile, 'justify-center border-dashed border-white/15 text-white/60 hover:border-white/30 hover:text-white')}>
        <span className="flex size-[52px] items-center justify-center">
          <Plus className="size-5" />
        </span>
        <span>New room</span>
      </button>
    </div>
  );
}
