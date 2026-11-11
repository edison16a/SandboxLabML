'use client';

import { useState } from 'react';
import { Dices } from 'lucide-react';
import { DEFAULT_DRIVING_BLUEPRINT, type DrivingBlueprint } from '@/engine/driving/blueprints';
import { BUILT_IN_CITIES, HELD_OUT_CITY_IDS } from '@/engine/driving/city/presets';
import { DRIVING_LEVELS } from '@/engine/driving/levels';
import { cityOf, DEFAULT_DRIVING_SETTINGS, MAX_TRIPS, MIN_TRIPS, randomCityId, type DrivingSettings } from '@/engine/driving/run/settings';
import { createEpisodeRunConfig } from '@/engine/training/newRun';
import { NewRunShell } from '@/features/lab/newrun/NewRunShell';
import type { BlueprintOf, ScriptChoice } from '@/features/scripts/scriptChoice';
import { cn } from '@/ui/cn';
import { Field } from '@/ui/primitives/Field';
import { Segmented } from '@/ui/primitives/Segmented';
import { CityThumb } from './CityThumb';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Prefill the script, e.g. when Studio sends a script here to train. */
  initialScript?: ScriptChoice<BlueprintOf<'driving'>>;
}

const tile = (on: boolean) => cn('flex flex-col items-center gap-1 rounded-md border p-2 text-[12px] transition-colors', on ? 'border-accent bg-accent-soft text-fg' : 'border-border text-muted hover:border-border-strong');
const heldOut = (id: string) => (HELD_OUT_CITY_IDS as readonly string[]).includes(id);
const TRIPS = Array.from({ length: MAX_TRIPS - MIN_TRIPS + 1 }, (_, k) => String(MIN_TRIPS + k));

/** The shared new run dialog with Driving's own fields: the city, where the levels start, and trips per generation. */
export function NewRunDialog({ open, onOpenChange, initialScript }: Props) {
  const [city, setCity] = useState(DEFAULT_DRIVING_SETTINGS.city);
  const [auto, setAuto] = useState(DEFAULT_DRIVING_SETTINGS.auto);
  const [level, setLevel] = useState(DEFAULT_DRIVING_SETTINGS.level);
  const [trips, setTrips] = useState(String(DEFAULT_DRIVING_SETTINGS.trips));
  const random = city.startsWith('random-');
  const cityHint = heldOut(city) ? 'The benchmark drives here, so training here makes its score say less.' : random ? 'A new street grid from a seed.' : 'Where runs train by default.';

  return (
    <NewRunShell<DrivingBlueprint>
      open={open}
      onOpenChange={onOpenChange}
      title="New driving run"
      defaultBlueprint={DEFAULT_DRIVING_BLUEPRINT}
      // A script's brain is a Driving preset (choiceFromSource checks the env), so it has the Driving sensor groups.
      initialScript={initialScript as ScriptChoice<DrivingBlueprint> | undefined}
      build={(basics) => {
        const settings: DrivingSettings = { city, level, auto, trips: Number(trips) };
        return createEpisodeRunConfig({ env: 'driving', ...basics, settings: { ...settings } });
      }}
      besideSeed={
        <Field label="Trips" hint="Per brain, per generation.">
          <Segmented label="Trips per generation" value={trips} onChange={setTrips} options={TRIPS.map((t) => ({ value: t, label: t }))} />
        </Field>
      }
    >
      <Field label="City" hint={cityHint}>
        <div className="grid grid-cols-4 gap-2">
          {BUILT_IN_CITIES.map((c) => (
            <button key={c.id} type="button" onClick={() => setCity(c.id)} className={tile(c.id === city)} aria-pressed={c.id === city}>
              <CityThumb spec={c} size={56} className={c.id === city ? 'text-accent' : 'text-muted'} />
              {c.name}
            </button>
          ))}
          <button type="button" onClick={() => setCity(randomCityId(Math.floor(Math.random() * 1e6)))} className={cn(tile(random), 'justify-center')} aria-pressed={random}>
            {random ? <CityThumb spec={cityOf(city)} size={56} className="text-accent" /> : <Dices className="size-6" />}
            Random
          </button>
        </div>
      </Field>
      <Field label="Levels" hint={auto ? 'Moves up once the best fifth arrives safely. Pick where it starts.' : 'Stays on this level the whole run.'}>
        <div className="flex flex-col gap-2">
          <Segmented<'auto' | 'fixed'>
            label="How the level is chosen"
            size="sm"
            className="self-start"
            value={auto ? 'auto' : 'fixed'}
            onChange={(v) => setAuto(v === 'auto')}
            options={[
              { value: 'auto', label: 'Curriculum' },
              { value: 'fixed', label: 'Fixed level' },
            ]}
          />
          <div className="grid grid-cols-5 gap-1.5">
            {DRIVING_LEVELS.map((l) => (
              <button key={l.id} type="button" onClick={() => setLevel(l.id)} className={cn(tile(l.id === level), 'items-start px-2 text-left')} aria-pressed={l.id === level}>
                <span className="tabular font-mono text-[11px] text-subtle">{l.id}</span>
                <span className="leading-tight">{l.name}</span>
              </button>
            ))}
          </div>
        </div>
      </Field>
    </NewRunShell>
  );
}
