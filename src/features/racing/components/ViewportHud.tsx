'use client';

import { Crosshair, Gauge, ScanEye, Video } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Segmented } from '@/ui/primitives/Segmented';
import { Select } from '@/ui/primitives/Select';
import { Tooltip } from '@/ui/primitives/Tooltip';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { useRacingLab, viewportHeld, type CameraMode, type ViewMode } from '../state/labStore';
import { GhostMenu } from './GhostMenu';
import { LiveStats } from './LiveStats';

const glass = 'border-white/10 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60';

function FocusChip() {
  const focus = useRacingLab((s) => s.focus);
  const set = useRacingLab((s) => s.set);
  if (focus.kind === 'champion') return null;
  const label = focus.kind === 'car' ? `Car ${focus.index + 1}` : `Gen ${focus.generation + 1} ghost`;
  return (
    <Button size="sm" variant="secondary" className={glass} onClick={() => set({ focus: { kind: 'champion' } })}>
      <Crosshair />
      {label}
      <span className="text-white/50">follow leader</span>
    </Button>
  );
}

/** Says why the picture stopped moving while Max trains, and how to get it back. */
function HeldNote() {
  const held = useRacingLab(viewportHeld);
  if (!held) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/60 px-3 py-2 text-[12px] text-white/85 backdrop-blur-sm">
        <Gauge className="size-3.5 text-accent" />
        Paused while Max trains. Pick Turbo to watch.
      </div>
    </div>
  );
}

/** Controls and stats layered over the viewport. */
export function ViewportHud({ population }: { population: SnapshotStream | null }) {
  const view = useRacingLab((s) => s.view);
  const camera = useRacingLab((s) => s.camera);
  const inputs = useRacingLab((s) => s.inputsOverlay);
  const mode = useRacingLab((s) => s.mode);
  const set = useRacingLab((s) => s.set);
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
          <Segmented<ViewMode>
            data-tour="view"
            label="What to show"
            size="sm"
            value={view}
            onChange={(v) => set({ view: v })}
            className="border-white/10 bg-black/45 backdrop-blur-sm"
            overlay
            options={[
              { value: 'population', label: 'Population', title: 'The live generation' },
              { value: 'overlay', label: 'Overlay', title: 'Ghosts of past champions' },
              { value: 'both', label: 'Both' },
            ]}
          />
          <GhostMenu />
          <Tooltip content="Show what the car senses" shortcut="I">
            <Button
              data-tour="inputs"
              size="sm"
              variant="secondary"
              className={inputs ? 'border-accent/60 bg-accent/25 text-white' : glass}
              onClick={() => set({ inputsOverlay: !inputs })}
              aria-pressed={inputs}
            >
              <ScanEye />
              Inputs
            </Button>
          </Tooltip>
          <Select<CameraMode>
            label="Camera"
            value={camera}
            onChange={(v) => set({ camera: v })}
            className={`h-7 w-28 ${glass}`}
            options={[
              { value: 'chase', label: 'Chase cam' },
              { value: 'orbit', label: 'Orbit' },
              { value: 'top', label: 'Top down' },
              { value: 'free', label: 'Free' },
            ]}
          />
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
