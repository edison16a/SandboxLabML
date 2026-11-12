'use client';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { SUV } from '@/engine/driving/car/params';
import { CityScene } from '@/render/driving/CityScene';
import { FrameDriver } from '@/render/driving/frame/FrameDriver';
import { createFrame, DrivingSceneContext, type DrivingView } from '@/render/driving/frame/sceneContext';
import { CityEffects } from '@/render/driving/post/CityEffects';
import { TIERS } from '@/render/driving/quality';
import { FramePacer } from '@/render/shared/FramePacer';
import { useFrameLoop } from '@/render/shared/frameLoop';
import { Prewarm } from '@/render/shared/Prewarm';
import { FeedStepper } from '../feed/FeedStepper';
import type { HeroSceneProps } from '../feed/sceneProps';
import type { PaneView } from '../stage/paneView';
import type { DriveFeed } from './driveFeed';
import { HeroChaseCamera } from './HeroChaseCamera';

/** The view the hero holds: the chase camera on the one SUV, its sensors out. */
const VIEW: DrivingView = { camera: 'chase', sensors: true, focus: 0, population: false };

/**
 * The city half of the landing hero: the lab's own city, light, traffic,
 * people and SUV, with the trained SUV driving its trips and its lidar,
 * route ribbon and intent arrows drawn from what its brain read. It is
 * its own canvas with the lab's post effects, so it looks like the lab.
 * The trip changes only while the cut is dark.
 */
export function HeroDriveScene({ feed, tier, pane, running, onWarm, dip }: HeroSceneProps<DriveFeed> & { pane: PaneView }) {
  const look = TIERS[tier];
  const loop = useFrameLoop(running ? 'live' : 'held');
  const frame = useMemo(() => createFrame(), []);
  const target = useRef(new THREE.Vector3());
  const live = useRef(false);
  const [warm, setWarm] = useState(false);
  const [trip, setTrip] = useState(feed.trip);
  useEffect(() => feed.onEpisode(() => setTrip(feed.trip)), [feed]);
  const value = useMemo(
    () => ({ city: trip.city, route: trip.route, car: SUV, inputs: feed.driver.file.inputs, population: feed.population, world: feed.world, tier, view: VIEW, frame, observed: feed.observed }),
    [trip, feed, tier, frame],
  );
  const isReady = useCallback(() => feed.population.curr !== null, [feed]);
  const ready = useCallback(() => {
    live.current = true;
    setWarm(true);
    onWarm();
  }, [onWarm]);

  return (
    <Canvas
      shadows={look.shadows}
      dpr={look.dpr}
      gl={{ antialias: look.antialias, powerPreference: 'high-performance', toneMapping: look.post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping }}
      camera={{ fov: 46, near: 0.4, far: 5000, position: [0, 40, 60] }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMappingExposure = 0.95;
      }}
      frameloop={loop.frameloop}
      style={{ pointerEvents: 'none' }}
    >
      <FramePacer loop={loop} />
      <DrivingSceneContext.Provider value={value}>
        <FeedStepper feed={feed} live={live} dip={dip} />
        <Prewarm isReady={isReady} stepping={!running} onWarm={ready} />
        <FrameDriver />
        <CityScene target={target} />
        <HeroChaseCamera pane={pane} target={target} />
        {/* The effect chain draws every frame on its own, so it waits until the scene has compiled behind the poster. */}
        {warm && <CityEffects tier={tier} />}
      </DrivingSceneContext.Provider>
    </Canvas>
  );
}
