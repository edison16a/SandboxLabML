'use client';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { PerformanceMonitor } from '@react-three/drei';
import { useMemo, useRef } from 'react';
import type { InputSpec } from '@/engine/env/types';
import type { Track } from '@/engine/racing/track/types';
import { useRacingLab, viewportHeld } from '@/features/racing/state/labStore';
import { Effects } from '@/render/shared/Effects';
import { lowerTier, raiseTier, tierDpr } from '@/render/shared/quality';
import { StatsProbe } from '@/render/shared/StatsProbe';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { CameraRig, useCameraMode } from './CameraRig';
import { ChampionCar } from './ChampionCar';
import { BrakeMap } from './BrakeMap';
import { CrashRings } from './CrashRings';
import { FrameDriver } from './FrameDriver';
import { Grandstand } from './Grandstand';
import { GhostCars } from './GhostCars';
import { PopulationCars } from './PopulationCars';
import { RacingEnvironment } from './RacingEnvironment';
import { RaysOverlay } from './RaysOverlay';
import { Scenery } from './Scenery';
import { createFrame, RacingSceneContext } from './sceneContext';
import { TireEffects } from './TireEffects';
import { TrackMesh } from './TrackMesh';

interface Props {
  track: Track;
  population: SnapshotStream | null;
  ghosts: SnapshotStream | null;
  schema: InputSpec[];
  children?: React.ReactNode;
}

/**
 * The Racing viewport. It only reads snapshots; nothing here can change a
 * training result, so quality and effects can scale freely.
 */
export function RacingCanvas({ track, population, ghosts, schema, children }: Props) {
  const tier = useRacingLab((s) => s.activeTier);
  const quality = useRacingLab((s) => s.quality);
  const camera = useCameraMode();
  // While a watch-speed run is paused nothing moves (ghosts pause too), so only redraw on demand.
  const idle = useRacingLab((s) => s.status === 'paused' && s.mode === 'train' && s.speed !== 'turbo' && s.speed !== 'max');
  // Max hands the whole machine to training, so the last frame simply stays up.
  const held = useRacingLab(viewportHeld);
  const frame = useMemo(() => createFrame(), []);
  const target = useRef(new THREE.Vector3());
  const value = useMemo(() => ({ track, population, ghosts, frame }), [track, population, ghosts, frame]);
  const lastChange = useRef(0);

  const step = (dir: -1 | 1) => {
    const s = useRacingLab.getState();
    if (s.quality !== 'auto') return;
    const now = performance.now();
    // Raising waits for ten seconds of headroom so the tier does not flip back and forth.
    if (dir > 0 && now - lastChange.current < 10_000) return;
    lastChange.current = now;
    s.set({ activeTier: dir < 0 ? lowerTier(s.activeTier) : raiseTier(s.activeTier) });
  };

  return (
    <Canvas
      shadows={tier !== 'low'}
      dpr={tierDpr(tier)}
      gl={{ antialias: tier === 'medium', powerPreference: 'high-performance', toneMapping: tier === 'high' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping, preserveDrawingBuffer: true }}
      camera={{ fov: 50, near: 0.5, far: 6000, position: [0, 60, 80] }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMappingExposure = 0.92;
      }}
      frameloop={held ? 'never' : idle ? 'demand' : 'always'}
      className="touch-none"
    >
      {quality === 'auto' && <PerformanceMonitor bounds={(r) => [Math.min(50, r * 0.8), r]} onDecline={() => step(-1)} onIncline={() => step(1)} />}
      <RacingSceneContext.Provider value={value}>
        <FrameDriver />
        <RacingEnvironment tier={tier} focus={target} />
        <TrackMesh track={track} />
        <Scenery track={track} count={tier === 'low' ? 140 : 320} />
        <Grandstand track={track} />
        <PopulationCars castShadow={tier === 'high'} />
        <GhostCars />
        <ChampionCar />
        {tier !== 'low' && <TireEffects />}
        <CrashRings />
        <BrakeMap />
        <RaysOverlay schema={schema} />
        <CameraRig mode={camera} target={target} />
        {children}
        <Effects tier={tier} />
        <StatsProbe
          instances={() => ({
            population: population?.count ?? 0,
            ghosts: ghosts?.count ?? 0,
            rays: frame.rayCount,
            ghostsSelected: useRacingLab.getState().ghostGenerations.length,
            generations: useRacingLab.getState().records.length,
          })}
        />
      </RacingSceneContext.Provider>
    </Canvas>
  );
}
