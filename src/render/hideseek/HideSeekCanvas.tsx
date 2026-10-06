'use client';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { useCallback, useMemo } from 'react';
import type { InputSpec } from '@/engine/env/types';
import { gridCapped, useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';
import { isIntegratedGpu } from '@/render/shared/quality';
import { StatsProbe } from '@/render/shared/StatsProbe';
import type { ArenaFeed } from '@/workers/client/arenaFeed';
import { CameraRig } from './camera/CameraRig';
import { FrameDriver } from './frame/FrameDriver';
import { createHsFrame, HsSceneContext } from './frame/sceneContext';
import { GridScene } from './grid/GridScene';
import { GRID_LAYER } from './grid/scratch';
import { overlayCounts, RaysOverlay } from './overlay/RaysOverlay';
import { Backdrop } from './scene/Backdrop';
import { InvalidateOnChange, MainPass, QualityMonitor, tierDpr, ToneMappingSync } from './scene/RenderHelpers';
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
  const quality = useHideSeekLab((s) => s.quality);
  const showcase = useHideSeekLab((s) => s.mode === 'sandbox' || s.gridSize === 1 || s.focus !== null);
  const sandbox = useHideSeekLab((s) => s.mode === 'sandbox');
  const effectsOn = useHideSeekLab((s) => s.effects);
  const photo = useHideSeekLab((s) => s.photoMode);
  const pov = useHideSeekLab((s) => s.pov);
  // Max trains headless with no replay, so nothing moves: draw only when the camera does.
  const animating = useHideSeekLab((s) => (s.status === 'running' && s.speed !== 'max') || s.replaying || (s.mode === 'sandbox' && s.sandbox.playing));
  const frame = useMemo(() => createHsFrame(), []);
  const value = useMemo(() => ({ frame, getFeed, schemas, onMoveBox, onToggleLock }), [frame, getFeed, schemas, onMoveBox, onToggleLock]);
  const composer = showcase && effectsOn && (tier === 'high' || tier === 'ultra');
  const pip = showcase && pov && tier !== 'low' && !photo;
  const instances = useCallback(
    () => ({
      arenas: frame.count,
      agents: frame.count * 2,
      boxes: frame.count * 4,
      showcase: frame.focusSlot >= 0 ? 1 : 0,
      rays: overlayCounts.rays,
      sightLines: overlayCounts.sightLines,
    }),
    [frame],
  );

  return (
    <Canvas
      shadows={{ enabled: tier !== 'low', type: THREE.PCFShadowMap }}
      dpr={tierDpr(tier)}
      frameloop={animating ? 'always' : 'demand'}
      gl={{ antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: true }}
      camera={{ fov: 42, near: 0.1, far: 2500, position: [0, 140, 160] }}
      onCreated={({ gl, camera, raycaster }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        camera.layers.enable(GRID_LAYER);
        raycaster.layers.enable(GRID_LAYER);
        if (isIntegratedGpu(gl.getContext())) {
          const s = useHideSeekLab.getState();
          const capped = gridCapped({ integratedGpu: true, quality: s.quality });
          s.set({ integratedGpu: true, ...(capped ? { effects: false, gridSize: s.gridSize > 25 ? 25 : s.gridSize } : {}) });
        }
      }}
      className="touch-none"
    >
      {quality === 'auto' && <QualityMonitor />}
      <HsSceneContext.Provider value={value}>
        <FrameDriver />
        <InvalidateOnChange feeds={feeds} />
        <ToneMappingSync composer={composer} />
        <StudioLighting tier={tier} shadows={showcase && tier !== 'low'} />
        <Backdrop />
        <GridScene />
        {showcase && <ShowcaseArena tier={tier} sandbox={sandbox} />}
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
