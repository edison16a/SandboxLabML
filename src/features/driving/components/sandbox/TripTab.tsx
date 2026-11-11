'use client';

import { Dices, Shuffle } from 'lucide-react';
import { BUILT_IN_CITIES } from '@/engine/driving/city/presets';
import { DRIVING_LEVELS, drivingLevel } from '@/engine/driving/levels';
import { cityOf, randomCityId } from '@/engine/driving/run/settings';
import { Button } from '@/ui/primitives/Button';
import { Segmented } from '@/ui/primitives/Segmented';
import { CityThumb } from '../../newrun/CityThumb';
import { drivingSession } from '../../session/DrivingSession';
import { useDrivingLab } from '../../state/labStore';
import { CityMap } from './CityMap';
import { overlayButton, overlayTile, sectionLabel } from './overlay';

const LEVELS = DRIVING_LEVELS.map((l) => ({ value: String(l.id), label: String(l.id), title: l.name }));
const newSeed = () => Math.floor(Math.random() * 1e6);

/**
 * Where the Sandbox drives: the city (a built in one or a fresh random
 * grid), the level, and the route, either picked from a seed or ended
 * wherever the user clicks on the map.
 */
export function TripTab() {
  const trip = useDrivingLab((s) => s.sandbox?.trip);
  const setup = useDrivingLab((s) => s.sandboxSetup);
  if (!trip) return null;
  const controls = () => drivingSession().sandbox;
  const random = trip.city.startsWith('random-');
  // A new city has new streets, so a destination picked on the old one no longer means anything.
  const setCity = (city: string) => controls()?.setTrip({ city, destination: null });

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <span className={sectionLabel}>City</span>
        <div className="grid grid-cols-4 gap-1.5">
          {BUILT_IN_CITIES.map((c) => (
            <button key={c.id} type="button" className={overlayTile(trip.city === c.id)} onClick={() => setCity(c.id)} aria-pressed={trip.city === c.id}>
              <CityThumb spec={c} size={40} className={trip.city === c.id ? 'text-accent' : 'text-white/60'} />
              {c.name}
            </button>
          ))}
          <button type="button" className={overlayTile(random)} onClick={() => setCity(randomCityId(newSeed()))} aria-pressed={random} title="A new street grid from a seed">
            {random ? <CityThumb spec={cityOf(trip.city)} size={40} className="text-accent" /> : <Dices className="m-2 size-6" />}
            Random
          </button>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className={sectionLabel}>Level</span>
          <span className="text-[12px] text-white/70">{drivingLevel(trip.level).name}</span>
        </div>
        <Segmented overlay size="sm" label="Level" className="w-full border-white/10 bg-white/[0.04] [&>*]:flex-1" value={String(trip.level)} options={LEVELS} onChange={(v) => controls()?.setTrip({ level: Number(v) })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <span className={sectionLabel}>Route</span>
          <Button size="sm" variant="secondary" className={overlayButton} onClick={() => controls()?.setTrip({ seed: newSeed(), destination: null })}>
            <Shuffle />
            New route
          </Button>
        </div>
        {setup && <CityMap setup={setup} onPick={(destination) => controls()?.setTrip({ destination })} />}
        <p className="text-[11px] leading-snug text-white/50">Click a street on the map to end the trip there.</p>
      </div>
    </div>
  );
}
