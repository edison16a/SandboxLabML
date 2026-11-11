'use client';

import { useCallback, useEffect, useMemo } from 'react';
import { SUV } from '@/engine/driving/car/params';
import { cityFor } from '@/engine/driving/city/buildCity';
import { drivingInputsOf } from '@/engine/driving/run/inputs';
import { cityOf } from '@/engine/driving/run/settings';
import { contentTrips } from '@/engine/driving/run/setup';
import { buildDrivingWorld } from '@/engine/driving/setup';
import { viewportHeld } from '@/features/lab/state/labState';
import { DrivingCanvas } from '@/render/driving/DrivingCanvas';
import type { DrivingView } from '@/render/driving/frame/sceneContext';
import { isWatchSpeed } from '@/workers/shared/protocol';
import type { WorkerPool } from '@/workers/client/workerPool';
import { usePopulationContent, useTripOnScreen } from '../hooks/useStreamContent';
import { StreamFrames } from '../session/frames';
import { focusIndex, pickedFocus, shownStream } from '../session/shown';
import { useDrivingLab } from '../state/labStore';

interface Props {
  streams: Pick<WorkerPool, 'population' | 'ghosts'>;
  onReady: (ready: boolean) => void;
  /** ?quality=ultra, for screenshots: High with every detail turned up. */
  ultra?: boolean;
}

/**
 * The city with whatever is driving it: the live generation at watch
 * speeds, past champions while Turbo trains or when the view asks for
 * them, or both at once. The city, the route on the road and the trip
 * come from the content of the stream on screen, so the streets always
 * match the SUVs driving them.
 */
export function DrivingViewport({ streams, onReady, ultra = false }: Props) {
  const run = useDrivingLab((s) => s.run);
  const viewMode = useDrivingLab((s) => s.view);
  const mode = useDrivingLab((s) => s.mode);
  const speed = useDrivingLab((s) => s.speed);
  const camera = useDrivingLab((s) => s.camera);
  const sensors = useDrivingLab((s) => s.inputsOverlay);
  const focus = useDrivingLab((s) => s.focus);
  const ghostGenerations = useDrivingLab((s) => s.ghostGenerations);
  const ghostContent = useDrivingLab((s) => s.ghostContent);
  const tier = useDrivingLab((s) => s.activeTier);
  const trip = useDrivingLab((s) => s.trip);
  const held = useDrivingLab(viewportHeld);
  const idle = useDrivingLab((s) => s.status !== 'running' && s.mode === 'train' && isWatchSpeed(s.speed) && s.status !== 'idle');

  const frames = useMemo(() => ({ population: new StreamFrames(streams.population), ghosts: new StreamFrames(streams.ghosts), over: new StreamFrames(streams.ghosts) }), [streams]);
  const shown = shownStream({ mode, view: viewMode, speed });
  const main = shown === 'population' ? frames.population : frames.ghosts;
  // Champions over the live generation only show on the trip it is driving.
  frames.over.match = frames.population;
  const over = shown === 'population' && viewMode === 'both' ? frames.over : null;
  useTripOnScreen(main);

  const popContent = usePopulationContent(streams.population);
  const content = shown === 'population' ? popContent : (ghostContent ?? popContent);
  const cityId = content?.city;
  const city = useMemo(() => (cityId ? cityFor(cityOf(cityId)) : null), [cityId]);
  const trips = useMemo(() => (content ? contentTrips(content) : []), [content]);
  const route = useMemo(() => {
    const t = trips[Math.min(trip, trips.length - 1)];
    return t ? buildDrivingWorld(t).route : null;
  }, [trips, trip]);
  const inputs = useMemo(() => (run ? drivingInputsOf(run) : null), [run]);

  const view = useMemo<DrivingView>(
    () => ({ camera, sensors, focus: focusIndex(focus, shown, ghostGenerations), population: true, colors: shown === 'ghosts' ? 'age' : 'species' }),
    [camera, sensors, focus, shown, ghostGenerations],
  );
  useEffect(() => useDrivingLab.getState().set({ inspectStream: shown }), [shown]);
  const onFocus = useCallback((index: number) => useDrivingLab.getState().set({ followed: index }), []);
  const onPick = useCallback(
    (index: number) => {
      const s = useDrivingLab.getState();
      s.set({ focus: pickedFocus(index, shownStream(s), s.ghostGenerations) });
    },
    [],
  );

  if (!city || !inputs) return <div className="h-full bg-bg" />;
  return (
    <DrivingCanvas
      city={city}
      route={route}
      car={SUV}
      inputs={inputs}
      population={main}
      world={main}
      ghosts={over}
      tier={ultra ? 'ultra' : tier}
      view={view}
      activity={held ? 'held' : idle ? 'idle' : 'live'}
      onFocus={onFocus}
      onPick={onPick}
      onReady={onReady}
    />
  );
}
