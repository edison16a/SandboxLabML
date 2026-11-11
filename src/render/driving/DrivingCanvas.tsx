'use client';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import type { CarParams } from '@/engine/driving/car/params';
import type { City } from '@/engine/driving/city/types';
import type { Route } from '@/engine/driving/route/route';
import type { DrivingInputConfig } from '@/engine/driving/sensors/inputConfig';
import { FramePacer } from '@/render/shared/FramePacer';
import { useFrameLoop, type LoopActivity } from '@/render/shared/frameLoop';
import { CameraRig } from './camera/CameraRig';
import { CityScene } from './CityScene';
import { FrameDriver } from './frame/FrameDriver';
import { createFrame, DrivingSceneContext, type DrivingView } from './frame/sceneContext';
import type { FrameSource } from './frame/source';
import { CityEffects } from './post/CityEffects';
import { TIERS, type DrivingTier } from './quality';

export interface DrivingCanvasProps {
  city: City;
  route: Route | null;
  car: CarParams;
  inputs: DrivingInputConfig;
  population: FrameSource | null;
  world: FrameSource | null;
  tier: DrivingTier;
  view: DrivingView;
  /** Live scenes draw every frame, idle ones on demand, a held one keeps its last frame. */
  activity?: LoopActivity;
  children?: React.ReactNode;
}

/**
 * The self driving viewport. It only reads snapshots: nothing here can
 * change a training result, so quality and effects scale freely. The lab
 * and the preview both draw through this.
 */
export function DrivingCanvas({ city, route, car, inputs, population, world, tier, view, activity = 'live', children }: DrivingCanvasProps) {
  const look = TIERS[tier];
  const loop = useFrameLoop(activity);
  const frame = useMemo(() => createFrame(), []);
  const target = useRef(new THREE.Vector3());
  const value = useMemo(() => ({ city, route, car, inputs, population, world, tier, view, frame }), [city, route, car, inputs, population, world, tier, view, frame]);
  return (
    <Canvas
      shadows={look.shadows}
      dpr={look.dpr}
      gl={{ antialias: look.antialias, powerPreference: 'high-performance', toneMapping: look.post ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping, preserveDrawingBuffer: true }}
      camera={{ fov: 52, near: 0.4, far: 5000, position: [0, 40, 60] }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMappingExposure = 0.95;
      }}
      frameloop={loop.frameloop}
      className="touch-none"
    >
      <FramePacer loop={loop} />
      <DrivingSceneContext.Provider value={value}>
        <FrameDriver />
        <CityScene target={target} />
        <CameraRig mode={view.camera} target={target} />
        {children}
        <CityEffects tier={tier} />
      </DrivingSceneContext.Provider>
    </Canvas>
  );
}
