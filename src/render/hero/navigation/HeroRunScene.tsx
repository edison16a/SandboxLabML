'use client';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { useCallback, useMemo, useRef, useState } from 'react';
import { CourseScene } from '@/render/navigation/course/CourseScene';
import { BlobShadows } from '@/render/navigation/crowd/BlobShadows';
import { ChampionAgent } from '@/render/navigation/crowd/ChampionAgent';
import { createNavFrame } from '@/render/navigation/frame/navFrame';
import { NavFrameDriver } from '@/render/navigation/frame/NavFrameDriver';
import { NavSceneContext, type NavView } from '@/render/navigation/frame/sceneContext';
import { NavEffects, navDpr, ToneMappingSync } from '@/render/navigation/scene/NavEffects';
import { NavLighting } from '@/render/navigation/scene/NavLighting';
import { SensorOverlay } from '@/render/navigation/sensors/SensorOverlay';
import { FramePacer } from '@/render/shared/FramePacer';
import { Prewarm } from '@/render/shared/Prewarm';
import { FeedStepper } from '../feed/FeedStepper';
import { useHeroFrameLoop } from '../feed/heroFrameLoop';
import type { HeroSceneProps } from '../feed/sceneProps';
import type { PaneView } from '../stage/paneView';
import { HeroFollowCamera } from './HeroFollowCamera';
import type { RunFeed } from './runFeed';

/**
 * The course half of the landing hero: the Navigation lab's room, crates,
 * spikes, movers, character and daylight, with the trained runner crossing
 * its courses and its sensor fan drawn from what its brain read. Its own
 * canvas, with the lab's post effects on High.
 */
export function HeroRunScene({ feed, tier, pane, running, onWarm, dip }: HeroSceneProps<RunFeed> & { pane: PaneView }) {
  const loop = useHeroFrameLoop(running, tier);
  const frame = useMemo(() => createNavFrame(), []);
  const live = useRef(false);
  const [warm, setWarm] = useState(false);
  const view = useMemo<NavView>(() => ({ tier, sensors: true, hoveredInput: -1 }), [tier]);
  const getFeed = useCallback(() => feed, [feed]);
  const value = useMemo(() => ({ frame, getFeed, view }), [frame, getFeed, view]);
  const composer = tier === 'high';
  const shadows = tier !== 'low';
  const isReady = useCallback(() => frame.course !== null && frame.curr !== null, [frame]);
  const ready = useCallback(() => {
    live.current = true;
    setWarm(true);
    onWarm();
  }, [onWarm]);

  return (
    <Canvas
      shadows={{ enabled: shadows, type: THREE.PCFShadowMap }}
      dpr={navDpr(tier)}
      frameloop={loop.frameloop}
      gl={{ antialias: true, stencil: true, powerPreference: 'high-performance' }}
      camera={{ fov: 40, near: 0.1, far: 900, position: [-30, 30, 30] }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
      style={{ pointerEvents: 'none' }}
    >
      <FramePacer loop={loop} />
      <NavSceneContext.Provider value={value}>
        <FeedStepper feed={feed} live={live} dip={dip} />
        <Prewarm isReady={isReady} stepping={!running} onWarm={ready} />
        <NavFrameDriver />
        <ToneMappingSync composer={composer} />
        <NavLighting tier={tier} shadows={shadows} />
        <CourseScene tier={tier} aoPass={composer} />
        {!shadows && <BlobShadows />}
        <ChampionAgent tier={tier} />
        <SensorOverlay />
        <HeroFollowCamera pane={pane} />
        {composer && warm && <NavEffects tier={tier} />}
      </NavSceneContext.Provider>
    </Canvas>
  );
}
