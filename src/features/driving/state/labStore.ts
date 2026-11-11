import { create } from 'zustand';
import type { DrivingContent } from '@/engine/driving/run/content';
import { DRIVING_ENGINE_VERSION } from '@/engine/driving/version';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import { labDefaults, openedLabState, type LabState } from '@/features/lab/state/labState';
import type { DrivingCamera } from '@/render/driving/frame/sceneContext';

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
  set: (patch: Partial<DrivingLabState>) => void;
}

/**
 * Lab state for a run that was just opened: the shared fields and nothing
 * left from the run before. The content is not touched: the coordinator
 * sends the new run's content while it loads, before this lands.
 */
export function openedRunState(run: RunConfig, records: GenerationRecord[], liveGeneration: number, leaving: DrivingLabState['mode'] = 'train'): Partial<DrivingLabState> {
  return { ...openedLabState(run, records, liveGeneration, DRIVING_ENGINE_VERSION, leaving), trip: 0, trips: 1, followed: -1 };
}

export const useDrivingLab = create<DrivingLabState>((set) => ({
  ...labDefaults('chase'),
  camera: 'chase',
  content: null,
  ghostContent: null,
  trip: 0,
  trips: 1,
  followed: -1,
  set: (patch) => set(patch),
}));
