'use client';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { useCallback, useEffect, useMemo } from 'react';
import { GRID_LAYER, XRAY_LAYER } from '@/render/hideseek/grid/scratch';
import { FramePacer } from '@/render/shared/FramePacer';
import { useFrameLoop } from '@/render/shared/frameLoop';
import { SceneReady } from '@/render/shared/SceneReady';
import { StatsProbe } from '@/render/shared/StatsProbe';
import { NavCameraRig } from './camera/NavCameraRig';
import { CourseScene } from './course/CourseScene';
import { BlobShadows } from './crowd/BlobShadows';
import { ChampionAgent } from './crowd/ChampionAgent';
import { CrowdAgents } from './crowd/CrowdAgents';
import { DeathFlash } from './crowd/DeathFlash';
import { GhostRunners } from './crowd/GhostRunners';
import { FrameHook } from './frame/FrameHook';
import { createNavFrame } from './frame/navFrame';
import { NavFrameDriver } from './frame/NavFrameDriver';
import { WakeOnChange } from './frame/WakeOnChange';
import { NavSceneContext, type NavView } from './frame/sceneContext';
import { NavEffects, navDpr, ToneMappingSync } from './scene/NavEffects';
import { NavLighting } from './scene/NavLighting';
import { SensorOverlay } from './sensors/SensorOverlay';
import type { NavCamera, NavFeed, NavQualityTier } from './types';

export interface NavigationCanvasProps {
  getFeed: () => NavFeed | null;
  /** A replay of past champions. It takes the population's place when that is not streaming, and rides along as ghosts on the same course. */
  getGhosts?: () => NavFeed | null;
  tier: NavQualityTier;
  camera: NavCamera;
  /** Draw the followed agent's sensors. */
  sensors: boolean;
  /** Post effects on High and Ultra. */
  effects?: boolean;
  /** Draw every frame (a run is playing) or only when something changes. */
  live: boolean;
  /** Keep the last frame up and draw nothing, while training has the machine. */
  held?: boolean;
  /** Index of the input hovered in a panel, to highlight its ray. */
  hoveredInput?: number;
  /** Runs first every frame with the wall time step, s: the preview advances its simulation here. */
  onFrame?: (dt: number) => void;
  /** Told once a course and its runners have drawn, so a loading cover can lift. */
  onReady?: (ready: boolean) => void;
  /** Told whenever the view moves to another agent: whether it is a ghost, and its index in its feed (-1 for none). */
  onFollow?: (ghost: boolean, index: number) => void;
  /** Anything else whose change should redraw an idle canvas for a moment, such as the view toggle or a new course. */
  wake?: unknown;
}

/**
 * The Navigation viewport. It only reads the feed; nothing here can change
 * a training result. The scene is the Hide and Seek look: tiled room,
 * golden crates, the grey block city, the same characters and the same
 * daylight, with the course pieces this game adds.
 */
export function NavigationCanvas({ getFeed, getGhosts, tier, camera, sensors, effects = true, live, held = false, hoveredInput = -1, onFrame, onReady, onFollow, wake }: NavigationCanvasProps) {
  const loop = useFrameLoop(held ? 'held' : live ? 'live' : 'idle');
  const frame = useMemo(() => createNavFrame(), []);
  const view = useMemo<NavView>(() => ({ tier, sensors, hoveredInput }), []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    view.tier = tier;
    view.sensors = sensors;
    view.hoveredInput = hoveredInput;
  }, [view, tier, sensors, hoveredInput]);
  const value = useMemo(() => ({ frame, getFeed, getGhosts, view }), [frame, getFeed, getGhosts, view]);
  const composer = effects && (tier === 'high' || tier === 'ultra');
  const shadows = tier !== 'low';
  const instances = useMemo(() => () => ({ agents: frame.primaryGhosts ? 0 : frame.count, ghosts: frame.ghosts.count, movers: frame.course?.movers.length ?? 0, rays: frame.rays }), [frame]);
  const hasCourse = useCallback(() => frame.course !== null && frame.curr !== null, [frame]);

  return (
    <Canvas
      shadows={{ enabled: shadows, type: THREE.PCFShadowMap }}
      dpr={navDpr(tier)}
      frameloop={loop.frameloop}
      gl={{ antialias: true, stencil: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      camera={{ fov: 42, near: 0.1, far: 2500, position: [-30, 30, 30] }}
      onCreated={({ gl, camera: cam }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        cam.layers.enable(GRID_LAYER);
        cam.layers.enable(XRAY_LAYER);
      }}
      className="touch-none"
    >
      <FramePacer loop={loop} />
      {loop.activity === 'idle' && <WakeOnChange keys={[camera, sensors, hoveredInput, tier, wake]} />}
      <NavSceneContext.Provider value={value}>
        {onFrame && <FrameHook onFrame={onFrame} />}
        <NavFrameDriver onFollow={onFollow} />
        <ToneMappingSync composer={composer} />
        <NavLighting tier={tier} shadows={shadows} />
        <CourseScene tier={tier} aoPass={composer} />
        <CrowdAgents />
        <GhostRunners />
        {!shadows && <BlobShadows />}
        <ChampionAgent tier={tier} />
        <DeathFlash />
        <SensorOverlay />
        <NavCameraRig mode={camera} />
        {composer && <NavEffects tier={tier} />}
        {onReady && <SceneReady isReady={hasCourse} onChange={onReady} />}
        <StatsProbe wholeFrame instances={instances} />
      </NavSceneContext.Provider>
    </Canvas>
  );
}
