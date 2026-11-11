'use client';

import { History, Video } from 'lucide-react';
import { CameraSelect, FocusChip, HeldNote, InputsToggle, ViewSwitch } from '@/features/lab/components/ViewportControls';
import { cameraLabel } from '@/render/driving/camera/CameraRig';
import { DRIVING_CAMERAS } from '@/render/driving/frame/sceneContext';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { isWatchSpeed } from '@/workers/shared/protocol';
import { shownStream } from '../session/shown';
import { useDrivingLab } from '../state/labStore';
import { LiveStats } from './LiveStats';

const CAMERAS = DRIVING_CAMERAS.map((value) => ({ value, label: cameraLabel(value) }));

/** Says what the picture shows while Turbo trains out of sight. */
function TurboNote() {
  const on = useDrivingLab((s) => s.status === 'running' && s.speed === 'turbo' && s.mode === 'train');
  const hasGhosts = useDrivingLab((s) => s.ghostGenerations.length > 0);
  if (!on || !hasGhosts) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/60 px-3 py-2 text-[12px] text-white/85 backdrop-blur-sm">
        <History className="size-3.5 text-accent" />
        Turbo trains out of sight. Past champions drive here.
      </div>
    </div>
  );
}

/** Controls and stats layered over the city. */
export function ViewportHud({ streams }: { streams: { population: SnapshotStream; ghosts: SnapshotStream } }) {
  const shown = useDrivingLab(shownStream);
  const watching = useDrivingLab((s) => isWatchSpeed(s.speed) && s.mode === 'train');
  return (
    <>
      {/* Stats and controls share one row, so on a narrow viewport the stats wrap instead of sliding under the
          controls. On a phone the controls become one row across the top that scrolls sideways, with the stats below it. */}
      <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2 max-sm:flex-col-reverse max-sm:items-stretch">
        <div className="flex min-w-0 flex-col items-start gap-2">
          <LiveStats stream={shown === 'ghosts' ? streams.ghosts : streams.population} shown={shown} />
          <div className="pointer-events-auto">
            <FocusChip />
          </div>
        </div>
        <div className="no-scrollbar pointer-events-auto flex max-w-[60%] shrink-0 flex-wrap items-center justify-end gap-1.5 max-sm:max-w-none max-sm:flex-nowrap max-sm:justify-start max-sm:overflow-x-auto max-sm:[&>*]:shrink-0">
          <ViewSwitch />
          <InputsToggle />
          <span data-tour="camera">
            <CameraSelect options={CAMERAS} />
          </span>
        </div>
      </div>
      <HeldNote />
      <TurboNote />
      {watching && (
        <div className="pointer-events-none absolute right-3 bottom-3 hidden items-center gap-1 rounded-md bg-black/40 px-2 py-1 text-[11px] text-white/70 md:flex">
          <Video className="size-3" /> Click an SUV to follow it
        </div>
      )}
    </>
  );
}
