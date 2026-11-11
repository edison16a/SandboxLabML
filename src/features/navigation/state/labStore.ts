import { create } from 'zustand';
import type { NavigationContent } from '@/engine/navigation/pipeline/content';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import { NAVIGATION_ENGINE_VERSION } from '@/engine/navigation/params';
import { labDefaults, openedLabState, type LabState } from '@/features/lab/state/labState';
import type { NavCamera } from '@/render/navigation/types';

/**
 * UI state for the Navigation lab: the shared lab fields, plus what the
 * population trains on and which runner the viewport follows. Snapshots
 * never go through here; they flow from the workers to the renderer.
 */
export interface NavigationLabState extends LabState {
  camera: NavCamera;
  /** The level, curriculum and course seeds training is on, from the coordinator. Null until the run loads. */
  content: NavigationContent | null;
  /** The runner the viewport follows, in its own feed (see viewFollowsGhost), or -1. */
  followed: number;

  set: (patch: Partial<NavigationLabState>) => void;
}

/**
 * The shared fields for a run that just opened, and nothing kept from the
 * run before. The content is left alone: the session cleared it before the
 * load, and the coordinator sends the new one while the load is under way.
 */
export function openedNavigationState(run: RunConfig, records: GenerationRecord[], generation: number, leaving: LabState['mode']): Partial<NavigationLabState> {
  return { ...openedLabState(run, records, generation, NAVIGATION_ENGINE_VERSION, leaving), followed: -1, viewFollowsGhost: false };
}

export const useNavigationLab = create<NavigationLabState>((set) => ({
  ...labDefaults('follow'),
  camera: 'follow',
  content: null,
  followed: -1,
  viewFollowsGhost: false,

  set: (patch) => set(patch),
}));
