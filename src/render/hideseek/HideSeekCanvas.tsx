'use client';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { useCallback, useMemo } from 'react';
import type { InputSpec } from '@/engine/env/types';
import { BOX_COUNT } from '@/engine/hideseek/physics';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';
import { FramePacer } from '@/render/shared/FramePacer';
import { useFrameLoop } from '@/render/shared/frameLoop';
import { StatsProbe } from '@/render/shared/StatsProbe';
import type { ArenaFeed } from '@/workers/client/arenaFeed';
import { CameraRig } from './camera/CameraRig';
import { FrameDriver } from './frame/FrameDriver';
import { createHsFrame, HsSceneContext } from './frame/sceneContext';
import { GridScene } from './grid/GridScene';
import { GRID_LAYER, XRAY_LAYER } from './grid/scratch';
import { overlayCounts, RaysOverlay } from './overlay/RaysOverlay';
import { SandboxArena, sandboxStats } from './sandbox/SandboxArena';
import { Backdrop } from './scene/Backdrop';
import { InvalidateOnChange, MainPass, tierDpr, ToneMappingSync } from './scene/RenderHelpers';
import { StudioLighting } from './scene/StudioLighting';
import { PovViews } from './showcase/PovViews';
import { ShowcaseArena } from './showcase/ShowcaseArena';
import { ShowcaseEffects } from './showcase/ShowcaseEffects';

interface Props {
  getFeed: () => ArenaFeed | null;
  /** Every feed that can be on screen, so a paused canvas redraws when any of them sends a frame. */
  feeds: () => ArenaFeed[];
  schemas: [InputSpec[], InputSpec[]];
  onMoveBox?: (index: number, x: number, z: number) => void;
  onToggleLock?: (index: number, locked: boolean) => void;
}

/**
 * The Hide and Seek viewport. It only reads arena streams; nothing here can
 * change a training result. The grid is always cheap; the showcase arena,
 * its shadows and its post-processing mount only while an arena is focused.
 */
export function HideSeekCanvas({ getFeed, feeds, schemas, onMoveBox, onToggleLock }: Props) {
  const tier = useHideSeekLab((s) => s.activeTier);
  const showcase = useHideSeekLab((s) => s.mode === 'sandbox' || s.gridSize === 1 || s.focus !== null);
  const sandbox = useHideSeekLab((s) => s.mode === 'sandbox');
  const effectsOn = useHideSeekLab((s) => s.effects);
  const photo = useHideSeekLab((s) => s.photoMode);
  const pov = useHideSeekLab((s) => s.pov);
  // Max trains headless with no replay, so nothing moves: draw only when the camera does.
  const animating = useHideSeekLab((s) => (s.status === 'running' && s.speed !== 'max') || s.replaying || (s.mode === 'sandbox' && s.sandbox.playing));
  const loop = useFrameLoop(animating ? 'live' : 'idle');
  const frame = useMemo(() => createHsFrame(), []);
  const value = useMemo(() => ({ frame, getFeed, schemas, onMoveBox, onToggleLock }), [frame, getFeed, schemas, onMoveBox, onToggleLock]);
  const composer = showcase && effectsOn && (tier === 'high' || tier === 'ultra');
  const pip = showcase && pov && tier !== 'low' && !photo;
  const instances = useCallback(
    () => ({
      arenas: frame.count,
      agents: frame.count * 2,
      boxes: frame.count * BOX_COUNT,
      showcase: frame.focusSlot >= 0 ? 1 : 0,
      rays: overlayCounts.rays,
      sightLines: overlayCounts.sightLines,
      sandboxAgents: sandboxStats.agents,
      sandboxBoxes: sandboxStats.boxes,
      sandboxLocked: sandboxStats.locked,
      sandboxRamps: sandboxStats.ramps,
    }),
    [frame],
  );

  return (
    <Canvas
      shadows={{ enabled: tier !== 'low', type: THREE.PCFShadowMap }}
      dpr={tierDpr(tier)}
      frameloop={loop.frameloop}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      camera={{ fov: 42, near: 0.1, far: 2500, position: [0, 140, 160] }}
      onCreated={({ gl, camera, raycaster }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        camera.layers.enable(GRID_LAYER);
        camera.layers.enable(XRAY_LAYER);
        raycaster.layers.enable(GRID_LAYER);
      }}
      className="touch-none"
    >
      <FramePacer loop={loop} />
      <HsSceneContext.Provider value={value}>
        <FrameDriver />
        <InvalidateOnChange feeds={feeds} />
        <ToneMappingSync composer={composer} />
        <StudioLighting tier={tier} shadows={showcase && tier !== 'low'} />
        <Backdrop />
        <GridScene />
        {showcase && !sandbox && <ShowcaseArena tier={tier} aoPass={composer} />}
        {sandbox && <SandboxArena tier={tier} aoPass={composer} />}
        <RaysOverlay />
        <CameraRig />
        {composer && <ShowcaseEffects tier={tier} photo={photo} />}
        {pip && <PovViews />}
        {pip && !composer && <MainPass />}
        <StatsProbe wholeFrame instances={instances} />
      </HsSceneContext.Provider>
    </Canvas>
  );
}
