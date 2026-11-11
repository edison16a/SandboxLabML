'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { SUV } from '@/engine/driving/car/params';
import { cityFor } from '@/engine/driving/city/buildCity';
import { FULL_DRIVING_INPUTS } from '@/engine/driving/sensors/inputConfig';
import { buildDrivingWorld } from '@/engine/driving/setup';
import { cameraLabel } from '../camera/CameraRig';
import { DrivingCanvas } from '../DrivingCanvas';
import { DRIVING_CAMERAS, type DrivingCamera, type DrivingView } from '../frame/sceneContext';
import { drivingTier } from '../quality';
import { PreviewSim } from './previewSim';

function num(v: string | null, fallback: number): number {
  const n = Number(v);
  return v !== null && Number.isFinite(n) ? n : fallback;
}

/**
 * The city on its own, driven by autopilots on the main thread, so its
 * look can be judged before the lab exists. Address options: city, level,
 * seed, cars, camera, sensors (0 or 1), quality, at (seconds to run ahead
 * before the first frame) and freeze (1 holds the scene there). C cycles
 * cameras, S toggles sensors, 1 to 5 pick the level.
 */
export function DrivingPreview() {
  const params = useSearchParams();
  const cityId = params.get('city') ?? 'midtown';
  const seed = num(params.get('seed'), 7);
  const cars = Math.max(1, Math.min(32, num(params.get('cars'), 6)));
  const at = num(params.get('at'), 0);
  const freeze = params.get('freeze') === '1';
  const tier = drivingTier(params.get('quality'));
  const [level, setLevel] = useState(() => Math.max(1, Math.min(5, num(params.get('level'), 5))));
  const [camera, setCamera] = useState<DrivingCamera>(() => (DRIVING_CAMERAS as readonly string[]).includes(params.get('camera') ?? '') ? (params.get('camera') as DrivingCamera) : 'chase');
  const [sensors, setSensors] = useState(params.get('sensors') !== '0');
  const sim = useMemo(() => {
    const s = new PreviewSim({ cityId, level, seed, cars });
    if (at > 0) s.fastForward(at);
    return s;
  }, [cityId, level, seed, cars, at]);
  const [trip, setTrip] = useState(() => sim.setup);
  const world = useMemo(() => buildDrivingWorld(trip), [trip]);
  const city = useMemo(() => cityFor(trip.city), [trip]);
  const view = useMemo<DrivingView>(() => ({ camera, sensors, focus: num(params.get('focus'), -1), population: true }), [camera, sensors, params]);

  useEffect(() => {
    let raf = requestAnimationFrame(function loop(t) {
      raf = requestAnimationFrame(loop);
      sim.advance(t, freeze);
      if (sim.setup !== trip) setTrip(sim.setup);
    });
    return () => cancelAnimationFrame(raf);
  }, [sim, freeze, trip]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'c') setCamera((c) => DRIVING_CAMERAS[(DRIVING_CAMERAS.indexOf(c) + 1) % DRIVING_CAMERAS.length]);
      if (e.key === 's') setSensors((s) => !s);
      if (e.key >= '1' && e.key <= '5') setLevel(Number(e.key));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="fixed inset-0 bg-[var(--color-bg,#0b0e14)]">
      <DrivingCanvas city={city} route={world.route} car={SUV} inputs={FULL_DRIVING_INPUTS} population={sim.population} world={sim.world} tier={tier} view={view} />
      <div className="pointer-events-none absolute left-4 top-4 flex gap-4 rounded-md bg-black/55 px-3 py-2 font-mono text-xs text-white/85" data-testid="driving-preview-hud">
        <span>{world.level.name}</span>
        <span>{cameraLabel(camera)}</span>
        <span>{city.spec.name}</span>
      </div>
    </div>
  );
}
