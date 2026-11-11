import * as THREE from 'three';
import { createContext, useContext } from 'react';
import type { City } from '@/engine/driving/city/types';
import type { CarParams } from '@/engine/driving/car/params';
import type { Route } from '@/engine/driving/route/route';
import type { DrivingInputConfig } from '@/engine/driving/sensors/inputConfig';
import type { WorldState } from '@/engine/driving/world/state';
import type { DrivingTier } from '../quality';
import { tickMotion, type TickMotion } from '../motion/tickMotion';
import type { FrameSource } from './source';
import { focusSense, type FocusSense } from './focusSense';

/** Camera views. One key cycles them in this order. */
export const DRIVING_CAMERAS = ['chase', 'orbit', 'corner', 'top', 'free'] as const;
export type DrivingCamera = (typeof DRIVING_CAMERAS)[number];

/** How the city is being viewed. The lab owns these; the scene only reads them. */
export interface DrivingView {
  camera: DrivingCamera;
  /** Draw the followed SUV's sensors: route, intent, lidar, detections and the light it reads. */
  sensors: boolean;
  /** Learner to follow, or -1 to follow the best performer. */
  focus: number;
  /** Show the rest of the population as ghosts. */
  population: boolean;
}

export const DEFAULT_VIEW: DrivingView = { camera: 'chase', sensors: true, focus: -1, population: true };

/**
 * Per frame facts several scene parts need, filled in first every frame by
 * the frame driver: who is followed and where it is, the city's life blended
 * for this frame, and what the followed SUV's sensors see in it.
 */
export interface DrivingFrame {
  leader: number;
  /** Index in the population of the SUV the camera follows, or -1. */
  focus: number;
  pos: THREE.Vector3;
  yaw: number;
  speed: number;
  steer: number;
  pedal: number;
  status: number;
  flags: number;
  /** Route arc length of the followed SUV and the nearest route sample. */
  progress: number;
  routeIndex: number;
  motion: TickMotion;
  motionTick: number;
  /** The city blended for this frame, or null before the first world snapshot. */
  world: WorldState | null;
  sense: FocusSense;
  /** Bumped when a new episode starts, so cameras and trails start over instead of gliding across town. */
  epoch: number;
}

export function createFrame(): DrivingFrame {
  return {
    leader: -1,
    focus: -1,
    pos: new THREE.Vector3(),
    yaw: 0,
    speed: 0,
    steer: 0,
    pedal: 0,
    status: 0,
    flags: 0,
    progress: 0,
    routeIndex: 0,
    motion: tickMotion(),
    motionTick: -1,
    world: null,
    sense: focusSense(),
    epoch: 0,
  };
}

export interface DrivingSceneValue {
  city: City;
  route: Route | null;
  car: CarParams;
  inputs: DrivingInputConfig;
  population: FrameSource | null;
  world: FrameSource | null;
  tier: DrivingTier;
  view: DrivingView;
  frame: DrivingFrame;
}

export const DrivingSceneContext = createContext<DrivingSceneValue | null>(null);

export function useDrivingScene(): DrivingSceneValue {
  const v = useContext(DrivingSceneContext);
  if (!v) throw new Error('useDrivingScene must be used inside DrivingSceneContext');
  return v;
}
