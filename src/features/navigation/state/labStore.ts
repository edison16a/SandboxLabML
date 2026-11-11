import { create } from 'zustand';
import type { NavigationContent } from '@/engine/navigation/pipeline/content';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import { NAVIGATION_ENGINE_VERSION } from '@/engine/navigation/params';
import { labDefaults, openedLabState, type LabState } from '@/features/lab/state/labState';
import type { NavCamera } from '@/render/navigation/types';
import { SANDBOX_DEFAULTS, type NavSandbox } from './sandboxState';

/**
 * UI state for the Navigation lab: the shared lab fields, plus what the
 * population trains on and which runner the viewport follows. Snapshots
 * never go through here; they flow from the workers to the renderer.
 */
export interface NavigationLabState extends LabState {
  camera: NavCamera;
  /** The level, curriculum and course seeds training is on, from the coordinator. Null until the run loads. */
  content: NavigationContent | null;
  /** The runner the viewport follows, in its own stream (see inspectStream), or -1. */
  followed: number;
  /** The Sandbox setup. It outlives a run switch, except for the field, which belongs to one run. */
  sandbox: NavSandbox;

  set: (patch: Partial<NavigationLabState>) => void;
  setSandbox: (patch: Partial<NavSandbox>) => void;
}

/**
 * The shared fields for a run that just opened, and nothing kept from the
 * run before. The content is left alone: the session cleared it before the
 * load, and the coordinator sends the new one while the load is under way.
 */
export function openedNavigationState(run: RunConfig, records: GenerationRecord[], generation: number, leaving: LabState['mode']): Partial<NavigationLabState> {
  return { ...openedLabState(run, records, generation, NAVIGATION_ENGINE_VERSION, leaving), followed: -1, inspectStream: 'population', sandboxBrain: null };
}

/** The Sandbox after a run switch: its course and model picks stay, its champions and paused state do not. */
export function openedSandbox(s: NavSandbox): NavSandbox {
  return { ...s, field: [], paused: false };
}

export const useNavigationLab = create<NavigationLabState>((set) => ({
  ...labDefaults('follow'),
  camera: 'follow',
  content: null,
  followed: -1,
  inspectStream: 'population',
  sandboxBrain: null,
  sandbox: SANDBOX_DEFAULTS,

  set: (patch) => set(patch),
  setSandbox: (patch) => set((s) => ({ sandbox: { ...s.sandbox, ...patch } })),
}));
