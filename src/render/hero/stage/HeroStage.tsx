'use client';

import * as THREE from 'three';
import { Canvas, createPortal, useStore } from '@react-three/fiber';
import { useCallback, useLayoutEffect, useMemo, type ReactNode } from 'react';
import type { InputSpec } from '@/engine/env/types';
import type { SandboxRoom } from '@/engine/hideseek/sandbox/room';
import type { Track } from '@/engine/racing/track/types';
import type { QualityTier } from '@/features/racing/state/labStore';
import { FramePacer } from '@/render/shared/FramePacer';
import { useFrameLoop } from '@/render/shared/frameLoop';
import { tierDpr } from '@/render/shared/quality';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { ARENA_TONE, HeroArenaScene } from '../arena/HeroArenaScene';
import { CAR_TONE, HeroCarScene } from '../car/HeroCarScene';
import { createPaneView, setPaneView } from './paneView';
import type { Pane, SplitLayout } from './splitLayout';
import { createStageView, SplitRenderer, type StageView } from './SplitRenderer';

export interface StageCar {
  track: Track;
  stream: SnapshotStream;
  schema: InputSpec[];
}

export interface StageArena {
  room: SandboxRoom;
  stream: SnapshotStream;
}

interface Props {
  car: StageCar | null;
  arena: StageArena | null;
  layout: SplitLayout;
  tier: QualityTier;
  /** False while the hero is off screen or the tab hidden: the canvas then draws nothing. */
  running: boolean;
  /** Called once a scene has warmed up and starts fading in over the poster. */
  onShown: (scene: 'car' | 'arena') => void;
}

/**
 * Keeps a portal's size in step with its pane. A portal only copies the
 * size it was given when the canvas itself changes, which happens before
 * React hands it the new pane.
 */
function PaneSize({ width, height }: { width: number; height: number }) {
  const store = useStore();
  useLayoutEffect(() => {
    store.setState((s) => ({ size: { ...s.size, width, height } }));
  }, [store, width, height]);
  return null;
}

/** One scene in its own portal: its own scene graph, camera and size, sharing the canvas and its renderer. */
function Portal({ view, pane, children }: { view: StageView; pane: Pane; children: ReactNode }) {
  const { w, h } = pane.rect;
  return createPortal(
    <>
      <PaneSize width={w} height={h} />
      {children}
    </>,
    view.scene,
    { camera: view.camera, size: { width: w, height: h, top: 0, left: 0 } },
  );
}

/**
 * The landing hero's live scenes in one WebGL canvas: the racing scene and
 * the arena side by side (or stacked on a tall screen), each in a portal
 * with its own camera, drawn into its own pane by SplitRenderer. One
 * context instead of two halves the GPU memory and keeps the browser's
 * context limit well clear. The hero has no effect composer, so both
 * scenes share one renderer cleanly.
 */
export function HeroStage({ car, arena, layout, tier, running, onShown }: Props) {
  const loop = useFrameLoop(running ? 'live' : 'held');
  const views = useMemo(() => {
    const carView = createStageView(42, 0.5, 6000, CAR_TONE, createPaneView());
    const arenaView = createStageView(38, 0.1, 2500, ARENA_TONE, createPaneView());
    return { car: carView, arena: arenaView, list: [carView, arenaView] as const };
  }, []);
  // The renderer and the cameras read the panes every frame, so they are updated in place.
  useLayoutEffect(() => {
    setPaneView(views.car.pane, layout.car);
    setPaneView(views.arena.pane, layout.arena);
  }, [views, layout]);
  const carWarm = useCallback(() => {
    views.car.warm = true;
    onShown('car');
  }, [views, onShown]);
  const arenaWarm = useCallback(() => {
    views.arena.warm = true;
    onShown('arena');
  }, [views, onShown]);

  return (
    <Canvas
      shadows={{ enabled: tier !== 'low', type: THREE.PCFShadowMap }}
      dpr={tierDpr(tier)}
      gl={{ antialias: tier !== 'low', powerPreference: 'high-performance' }}
      frameloop={loop.frameloop}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <FramePacer loop={loop} />
      <SplitRenderer views={views.list} />
      {car && (
        <Portal view={views.car} pane={layout.car}>
          <HeroCarScene track={car.track} stream={car.stream} schema={car.schema} tier={tier} pane={views.car.pane} stepping={!running} onWarm={carWarm} />
        </Portal>
      )}
      {arena && (
        <Portal view={views.arena} pane={layout.arena}>
          <HeroArenaScene room={arena.room} stream={arena.stream} tier={tier} pane={views.arena.pane} stepping={!running} onWarm={arenaWarm} />
        </Portal>
      )}
    </Canvas>
  );
}
