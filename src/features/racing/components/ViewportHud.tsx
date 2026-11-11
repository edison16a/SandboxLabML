'use client';

import { Video } from 'lucide-react';
import { CameraSelect, FocusChip, HeldNote, InputsToggle, ViewSwitch } from '@/features/lab/components/ViewportControls';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { useRacingLab } from '../state/labStore';
import { GhostMenu } from './GhostMenu';
import { LiveStats } from './LiveStats';

const CAMERAS = [
  { value: 'chase', label: 'Chase cam' },
  { value: 'orbit', label: 'Orbit' },
  { value: 'trackside', label: 'Trackside' },
  { value: 'top', label: 'Top down' },
  { value: 'free', label: 'Free' },
] as const;

/** Controls and stats layered over the viewport. */
export function ViewportHud({ population }: { population: SnapshotStream | null }) {
  const mode = useRacingLab((s) => s.mode);
  return (
    <>
      {/* Stats and controls share one row, so on a narrow viewport the stats wrap instead of sliding under the
          controls. On a phone the controls become one row across the top that scrolls sideways, with the stats below it. */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
        <div className="flex min-w-0 flex-col items-start gap-2">
          <LiveStats stream={population} />
          <div className="pointer-events-auto">
            <FocusChip />
          </div>
        </div>
        <div className="no-scrollbar pointer-events-auto flex max-w-[60%] shrink-0 flex-wrap items-center justify-end gap-1.5 max-sm:max-w-none max-sm:flex-nowrap max-sm:justify-start max-sm:overflow-x-auto max-sm:[&>*]:shrink-0">
          <ViewSwitch />
          <GhostMenu />
          <InputsToggle />
          <CameraSelect options={CAMERAS} />
        </div>
      </div>
      <HeldNote />
      {/* The Sandbox panel docks in this corner, so the hint would show through its glass. */}
      {mode === 'train' && (
        <div className="pointer-events-none absolute right-3 bottom-3 hidden items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-[11px] text-white/70 md:flex">
          <Video className="size-3" /> Click a car to follow it
        </div>
      )}
    </>
  );
}
