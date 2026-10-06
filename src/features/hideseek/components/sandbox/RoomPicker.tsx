'use client';

import { Plus } from 'lucide-react';
import { isPresetRoomId, PRESET_ROOMS, type SandboxRoom } from '@/engine/hideseek/sandbox/room';
import { cn } from '@/ui/cn';
import { RoomThumb } from './RoomThumb';

interface Props {
  rooms: readonly SandboxRoom[];
  value: string;
  onPick: (id: string) => void;
  onNew: () => void;
}

/** A tile label: "Open room" fits as "Open". The user's own names stay exactly as typed. */
const label = (room: SandboxRoom) => (isPresetRoomId(room.id) ? room.name.replace(/ room$/, '') : room.name);

const tile = 'flex flex-col items-center gap-1 rounded-md border p-1 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-accent';

/** Preset rooms, then the user's own, then a tile to draw a new one. The grid scrolls past two rows. */
export function RoomPicker({ rooms, value, onPick, onNew }: Props) {
  const all = [...PRESET_ROOMS, ...rooms];
  const current = Math.max(
    0,
    all.findIndex((r) => r.id === value),
  );
  /** Picking the room already in play changes nothing, so it must not restart the match. */
  const pick = (id: string) => id !== value && onPick(id);
  /** Arrow keys move the pick through the tiles, four to a row, like any radio group. */
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: 4, ArrowUp: -4 }[e.key];
    if (!step) return;
    e.preventDefault();
    const next = Math.max(0, Math.min(all.length - 1, current + step));
    pick(all[next].id);
    e.currentTarget.querySelector<HTMLButtonElement>(`[data-room="${all[next].id}"]`)?.focus();
  };
  return (
    <div role="radiogroup" aria-label="Room" onKeyDown={onKeyDown} className="grid max-h-[174px] grid-cols-4 gap-1.5 overflow-y-auto pr-0.5">
      {all.map((room, i) => {
        const on = room.id === value;
        return (
          <button
            key={room.id}
            type="button"
            role="radio"
            aria-checked={on}
            tabIndex={i === current ? 0 : -1}
            data-room={room.id}
            title={room.name}
            onClick={() => pick(room.id)}
            className={cn(tile, on ? 'border-accent/70 bg-accent/15 text-white' : 'border-white/10 bg-white/[0.03] text-white/65 hover:bg-white/10 hover:text-white')}
          >
            <RoomThumb room={room} size={52} />
            <span className="w-full truncate text-center">{label(room)}</span>
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
