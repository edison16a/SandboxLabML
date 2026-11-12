import { create } from 'zustand';
import type { DrivingContent } from '@/engine/driving/run/content';
import type { DrivingInputConfig } from '@/engine/driving/sensors/inputConfig';
import type { DrivingSetup } from '@/engine/driving/setup';
import { DRIVING_ENGINE_VERSION } from '@/engine/driving/version';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import { labDefaults, openedLabState, type LabState } from '@/features/lab/state/labState';
import type { DrivingCamera } from '@/render/driving/frame/sceneContext';
import type { TrainedModel } from '../sandbox/model';
import type { DrivingSandbox } from '../sandbox/state';

/**
 * UI state for the Driving lab: the shared lab fields, plus what the city
 * on screen is built from. Snapshots never go through here; they flow from
 * the workers straight to the renderer.
 */
export interface DrivingLabState extends LabState {
  camera: DrivingCamera;
  /** What training drives right now (city, level, trips), from the coordinator. Null until a run loads. */
  content: DrivingContent | null;
  /** What the ghost replay drives: the content it was built on, which can lag the live one while Turbo trains. */
  ghostContent: DrivingContent | null;
  /** The trip on screen, from the shown stream's world block, and how many the generation drives. */
  trip: number;
  trips: number;
  /** The SUV the viewport follows in the stream it shows, or -1. */
  followed: number;
  /** What the Sandbox is set up to drive, kept while it is closed. Null until it first opens for the run. */
  sandbox: DrivingSandbox | null;
  sandboxPaused: boolean;
  /** The trip the Sandbox replay drives and the inputs its SUVs sense, so the viewport builds those streets and that lidar. */
  sandboxSetup: DrivingSetup | null;
  sandboxInputs: DrivingInputConfig | null;
  /** True while the Sandbox rehearses routes off screen for the trained model's first trip. */
  sandboxChecking: boolean;
  /** The shipped trained model, once loaded; null before, or when the build ships none. */
  trained: TrainedModel | null;
  /** Where loading the trained model stands, so the Sandbox can say it failed rather than wait forever. */
  trainedLoad: 'idle' | 'loading' | 'ready' | 'failed';
  set: (patch: Partial<DrivingLabState>) => void;
}

/**
 * Lab state for a run that was just opened: the shared fields and nothing
 * left from the run before. The content is not touched: the coordinator
 * sends the new run's content while it loads, before this lands.
 */
export function openedRunState(run: RunConfig, records: GenerationRecord[], liveGeneration: number, leaving: DrivingLabState['mode'] = 'train'): Partial<DrivingLabState> {
  return { ...openedLabState(run, records, liveGeneration, DRIVING_ENGINE_VERSION, leaving), trip: 0, trips: 1, followed: -1, sandbox: null, sandboxSetup: null, sandboxInputs: null, sandboxBrain: null };
}

export const useDrivingLab = create<DrivingLabState>((set) => ({
  ...labDefaults('chase'),
  camera: 'chase',
  content: null,
  ghostContent: null,
  trip: 0,
  trips: 1,
  followed: -1,
  sandbox: null,
  sandboxPaused: false,
  sandboxSetup: null,
  sandboxInputs: null,
  sandboxChecking: false,
  trained: null,
  trainedLoad: 'idle',
  set: (patch) => set(patch),
}));
