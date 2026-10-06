'use client';

import { useEffect, useState } from 'react';
import { Dices, SlidersHorizontal } from 'lucide-react';
import { RACING_BLUEPRINTS } from '@/engine/blueprints/presets';
import type { RacingBlueprint } from '@/engine/blueprints/types';
import type { CarPresetId } from '@/engine/racing/car/params';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { randomTrackSpec } from '@/engine/racing/track/randomTrack';
import type { TrackSpec } from '@/engine/racing/track/types';
import { createRacingRunConfig } from '@/engine/training/runConfig';
import { setSetting } from '@/storage/settings';
import { cn } from '@/ui/cn';
import { Button } from '@/ui/primitives/Button';
import { Dialog } from '@/ui/primitives/Dialog';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { LAST_RUN_KEY } from '../hooks/useRunBootstrap';
import { racingSession } from '../session/RacingSession';
import { blueprintInputCount } from '@/engine/blueprints/shape';
import { TrackThumb } from './TrackThumb';
import { ScriptPicker, type ScriptChoice } from './ScriptPicker';
import { BlueprintDialog } from '@/features/blueprints/BlueprintDialog';
import { listBlueprints } from '@/storage/blueprints';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill, e.g. when training on a track drawn in the editor. */
  initialTrack?: TrackSpec;
  /** Prefill the script, e.g. when Studio sends a script here to train. */
  initialScript?: ScriptChoice;
}

/**
 * Everything frozen at run creation: track, brain blueprint, script, physics,
 * population size and seed. Changing any of these later means a new run.
 */
export function NewRunDialog({ open, onOpenChange, initialTrack, initialScript }: Props) {
  const [name, setName] = useState('New run');
  const [track, setTrack] = useState<TrackSpec>(initialTrack ?? BUILT_IN_TRACKS[0]);
  const [blueprint, setBlueprint] = useState<RacingBlueprint>(RACING_BLUEPRINTS[2]);
  const [car, setCar] = useState<CarPresetId>('standard');
  const [pop, setPop] = useState<'50' | '100' | '150'>('100');
  const [seed, setSeed] = useState(() => Math.floor(Math.random() * 1e6));
  const [script, setScript] = useState<ScriptChoice>({ kind: 'builtin' });
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState<RacingBlueprint[]>([]);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (open && initialTrack) setTrack(initialTrack);
  }, [open, initialTrack]);
  useEffect(() => {
    if (open && initialScript) {
      setScript(initialScript);
      if (initialScript.kind === 'script') setName(initialScript.name);
    }
  }, [open, initialScript]);
  useEffect(() => {
    if (open) void listBlueprints('racing').then((list) => setCustom(list.filter((b): b is RacingBlueprint => b.env === 'racing')));
  }, [open]);
  const blueprints = [...RACING_BLUEPRINTS, ...custom];
  const tracks = initialTrack ? [initialTrack, ...BUILT_IN_TRACKS] : BUILT_IN_TRACKS;

  const create = async () => {
    setBusy(true);
    const bp = script.kind === 'script' && script.blueprint ? script.blueprint : blueprint;
    const config = createRacingRunConfig({
      name: name.trim() || 'Untitled run',
      seed,
      blueprint: bp,
      track,
      carPreset: car,
      populationSize: Number(pop),
      script: script.kind === 'script' ? script.compiled : undefined,
    });
    await racingSession().newRun(config);
    await setSetting(LAST_RUN_KEY, config.id);
    setBusy(false);
    onOpenChange(false);
    void racingSession().start();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="New racing run"
      description="These settings are frozen once the run starts, so every generation can be replayed exactly."
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void create()} disabled={busy}>
            Create and train
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <Field label="Name">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
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
        <ScriptPicker value={script} onChange={setScript} />
        {script.kind === 'builtin' && (
          <Field label="Brain blueprint" hint={blueprint.teaches || 'Your own blueprint.'}>
            <div className="grid grid-cols-2 gap-2">
              {blueprints.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => setBlueprint(b)}
                  className={cn('flex flex-col items-start gap-0.5 rounded-md border p-2.5 text-left', b.id === blueprint.id ? 'border-accent bg-accent-soft' : 'border-border hover:border-border-strong')}
                >
                  <span className="text-[13px] font-medium">{b.name.replace('Racing ', '')}</span>
                  <span className="text-[11px] text-muted">{blueprintInputCount(b)} inputs. {b.description ? `${b.description.split('.')[0]}.` : 'Custom blueprint.'}</span>
                </button>
              ))}
              <button type="button" onClick={() => setEditing(true)} className="flex items-center justify-center gap-2 rounded-md border border-dashed border-border p-2.5 text-[13px] text-muted hover:border-border-strong hover:text-fg">
                <SlidersHorizontal className="size-4" />
                Customize {blueprint.name.replace('Racing ', '')}
              </button>
            </div>
          </Field>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label="Car physics" hint={car === 'easy' ? 'More grip and stronger brakes.' : 'Realistic grip limit.'}>
            <Segmented<CarPresetId> label="Car physics" value={car} onChange={setCar} options={[{ value: 'standard', label: 'Standard' }, { value: 'easy', label: 'Easy' }]} />
          </Field>
          <Field label="Population">
            <Segmented label="Population size" value={pop} onChange={setPop} options={[{ value: '50', label: '50' }, { value: '100', label: '100' }, { value: '150', label: '150' }]} />
          </Field>
          <Field label="Seed" hint="Same seed, same results.">
            <TextInput type="number" value={seed} onChange={(e) => setSeed(Number(e.target.value) || 0)} />
          </Field>
        </div>
      </div>
      <BlueprintDialog
        open={editing}
        onOpenChange={setEditing}
        base={blueprint}
        title="Customize the brain"
        description="Pick what the car senses and how the brain starts. Saved as your own blueprint."
        action="Use this blueprint"
        onSave={(b) => {
          setCustom((list) => [b, ...list]);
          setBlueprint(b);
        }}
      />
    </Dialog>
  );
}
