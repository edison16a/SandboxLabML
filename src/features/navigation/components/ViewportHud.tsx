'use client';

import { Video } from 'lucide-react';
import { CameraSelect, FocusChip, HeldNote, InputsToggle, ViewSwitch } from '@/features/lab/components/ViewportControls';
import type { LabFeeds } from '../viewport/labFeeds';
import { GhostMenu } from './GhostMenu';
import { LiveStats } from './LiveStats';

/** The Navigation cameras in the order C cycles them. */
export const NAVIGATION_CAMERAS = [
  { value: 'follow', label: 'Follow' },
  { value: 'overview', label: 'Overview' },
  { value: 'top', label: 'Top down' },
  { value: 'free', label: 'Free' },
] as const;

/** Controls and stats layered over the viewport, laid out like every lab's. */
export function ViewportHud({ feeds }: { feeds: LabFeeds | null }) {
  return (
    <>
      {/* Stats and controls share one row; on a phone the controls become one row across the top that scrolls sideways, with the stats below. */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
        <div className="flex min-w-0 flex-col items-start gap-2">
          <LiveStats feeds={feeds} />
          <div className="pointer-events-auto">
            <FocusChip />
          </div>
        </div>
        <div className="no-scrollbar pointer-events-auto flex max-w-[60%] shrink-0 flex-wrap items-center justify-end gap-1.5 max-sm:max-w-none max-sm:flex-nowrap max-sm:justify-start max-sm:overflow-x-auto max-sm:[&>*]:shrink-0">
          <ViewSwitch />
          <GhostMenu />
          <InputsToggle />
          <CameraSelect options={NAVIGATION_CAMERAS} />
        </div>
      </div>
      <HeldNote />
      <div className="pointer-events-none absolute right-3 bottom-3 hidden items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-[11px] text-white/70 md:flex">
        <Video className="size-3" /> Click a runner to follow it
      </div>
    </>
  );
}
