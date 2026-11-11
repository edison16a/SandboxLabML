'use client';

import { useEffect, useState } from 'react';
import { Dices } from 'lucide-react';
import { RACING_BLUEPRINTS } from '@/engine/blueprints/presets';
import type { RacingBlueprint } from '@/engine/blueprints/types';
import type { CarPresetId } from '@/engine/racing/car/params';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { randomTrackSpec } from '@/engine/racing/track/randomTrack';
import type { TrackSpec } from '@/engine/racing/track/types';
import { createRacingRunConfig } from '@/engine/training/runConfig';
import { NewRunShell } from '@/features/lab/newrun/NewRunShell';
import type { ScriptChoice } from '@/features/scripts/scriptChoice';
import { cn } from '@/ui/cn';
import { Field } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { TrackThumb } from './TrackThumb';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill, e.g. when training on a track drawn in the editor. */
  initialTrack?: TrackSpec;
  /** Prefill the script, e.g. when Studio sends a script here to train. */
  initialScript?: ScriptChoice<RacingBlueprint>;
}

/** The shared new run dialog with Racing's own fields: the track and the car physics. */
export function NewRunDialog({ open, onOpenChange, initialTrack, initialScript }: Props) {
  const [track, setTrack] = useState<TrackSpec>(initialTrack ?? BUILT_IN_TRACKS[0]);
  const [car, setCar] = useState<CarPresetId>('standard');
  useEffect(() => {
    if (open && initialTrack) setTrack(initialTrack);
  }, [open, initialTrack]);
  // A built in track sent here unedited already has its tile.
  const tracks = initialTrack && !BUILT_IN_TRACKS.some((t) => t.id === initialTrack.id) ? [initialTrack, ...BUILT_IN_TRACKS] : BUILT_IN_TRACKS;

  return (
    <NewRunShell<RacingBlueprint>
      open={open}
      onOpenChange={onOpenChange}
      title="New racing run"
      defaultBlueprint={RACING_BLUEPRINTS[2]}
      initialScript={initialScript}
      build={(basics) => createRacingRunConfig({ ...basics, track, carPreset: car })}
      besideSeed={
        <Field label="Car physics" hint={car === 'easy' ? 'More grip and stronger brakes.' : 'Realistic grip limit.'}>
          <Segmented<CarPresetId> label="Car physics" value={car} onChange={setCar} options={[{ value: 'standard', label: 'Standard' }, { value: 'easy', label: 'Easy' }]} />
        </Field>
      }
    >
      <Field label="Track">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {tracks.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTrack(t)}
              className={cn('flex flex-col items-center gap-1 rounded-md border p-2 text-[12px] transition-colors', t.id === track.id ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:border-border-strong')}
            >
              <TrackThumb spec={t} size={56} className={t.id === track.id ? 'text-accent' : 'text-muted'} />
              {t.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setTrack(randomTrackSpec(Math.floor(Math.random() * 1e6)))}
            className={cn('flex flex-col items-center justify-center gap-1 rounded-md border p-2 text-[12px]', track.id.startsWith('random') ? 'border-accent bg-accent-soft' : 'border-border text-muted hover:border-border-strong')}
          >
            {track.id.startsWith('random') ? <TrackThumb spec={track} size={56} className="text-accent" /> : <Dices className="size-6" />}
            Random
          </button>
        </div>
      </Field>
    </NewRunShell>
  );
}
