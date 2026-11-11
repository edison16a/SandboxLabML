import type { StoreApi } from 'zustand';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import type { TrainingStatus } from '@/workers/coordinator/events';
import type { SpeedMode } from '@/workers/shared/protocol';
import type { GhostSelection } from '../session/ghostSelection';

export type ViewMode = 'population' | 'overlay' | 'both';
export type QualityTier = 'low' | 'medium' | 'high';

/** What the camera follows and what the inputs overlay inspects. `car` is any agent of the population. */
export type Focus = { kind: 'champion' } | { kind: 'car'; index: number } | { kind: 'ghost'; generation: number };

export type PanelTab = 'progress' | 'network' | 'species' | 'inputs' | 'model';

/**
 * UI state every single population lab has. A lab's own store extends it
 * with what only it needs (Racing: tracks, telemetry, the Sandbox field),
 * and the shared toolbar, side panel tabs and session read only these
 * fields. Snapshots never go through a store; they flow from the workers
 * straight to the renderer.
 */
export interface LabState {
  run: RunConfig | null;
  status: TrainingStatus;
  speed: SpeedMode;
  records: GenerationRecord[];
  liveGeneration: number;
  /** Set when stored ghosts cannot be replayed under the current engine. */
  replayBlocked: string | null;

  view: ViewMode;
  ghostSelection: GhostSelection;
  ghostGenerations: number[];
  /** The lab's own camera names (Racing: chase, orbit, trackside, top, free). */
  camera: string;
  focus: Focus;
  /** Render tier. Settings own the choice; the lab copies it here for the renderer. */
  activeTier: QualityTier;
  inputsOverlay: boolean;
  inputsScope: 'selected' | 'all';
  hoveredInput: number | null;
  panelTab: PanelTab;
  /** Generation shown in the network view; null follows the latest. */
  networkGeneration: number | null;
  /** Train runs the population; Sandbox replays champions in a scene the user sets up. */
  mode: 'train' | 'sandbox';
  /** Lesion test: input index mapped to the value it is forced to. Sandbox only. */
  lesions: Record<number, number>;
  /**
   * Set by a lab whose viewport follows a ghost on its own, such as when
   * the population is not on screen, so the inputs panels read the ghost
   * stream. Left out, only a clicked ghost or the Sandbox does that.
   */
  viewFollowsGhost?: boolean;
}

/** A lab store as the shared code sees it. A lab's own store is a superset, so it can stand in. */
export type LabStoreApi = StoreApi<LabState>;

/** Starting values of the shared fields, for a lab store's initializer. */
export function labDefaults(camera: string): LabState {
  return {
    run: null,
    status: 'idle',
    speed: '1x',
    records: [],
    liveGeneration: 0,
    replayBlocked: null,
    view: 'both',
    ghostSelection: { mode: 'auto' },
    ghostGenerations: [],
    camera,
    focus: { kind: 'champion' },
    activeTier: 'high',
    inputsOverlay: false,
    inputsScope: 'selected',
    hoveredInput: null,
    panelTab: 'progress',
    networkGeneration: null,
    mode: 'train',
    lesions: {},
  };
}

/**
 * Shared lab state for a run that was just opened: its history, a clean
 * focus and nothing cached from the run before. `leaving` is the mode the
 * lab was in; coming out of the Sandbox also brings the population back.
 */
export function openedLabState(run: RunConfig, records: GenerationRecord[], liveGeneration: number, engineVersion: number, leaving: LabState['mode'] = 'train') {
  const opened: Partial<Omit<LabState, 'camera'>> = {
    ...(leaving === 'sandbox' && { view: 'both' as const }),
    run,
    records,
    liveGeneration,
    status: 'idle',
    replayBlocked: run.engineVersion === engineVersion ? null : 'This run was trained on an older engine, so its generations cannot be replayed.',
    focus: { kind: 'champion' },
    networkGeneration: null,
    ghostGenerations: [],
    // A Sandbox set up for one run means nothing for the next, so it closes and starts over.
    mode: 'train',
    lesions: {},
  };
  return opened;
}

/** The records after appending finished generations, oldest first. */
export function withRecords<R extends GenerationRecord>(records: R[], batch: R[]): { records: R[]; liveGeneration: number } | null {
  if (!batch.length) return null;
  const first = batch[0].generation;
  // Records can arrive again after a resume from an older checkpoint; they replace the old ones from there on.
  const kept = records.length && records[records.length - 1].generation >= first ? records.filter((r) => r.generation < first) : records;
  return { records: [...kept, ...batch], liveGeneration: batch[batch.length - 1].generation + 1 };
}

/**
 * True when the followed agent is a ghost: the user clicked one, the lab
 * is in the Sandbox, where only ghosts move and the population stream sits
 * frozen on its last training frame, or the lab's viewport says so.
 */
export function followsGhost(s: { focus: Focus; mode: 'train' | 'sandbox'; viewFollowsGhost?: boolean }): boolean {
  return s.focus.kind === 'ghost' || s.mode === 'sandbox' || s.viewFollowsGhost === true;
}

/**
 * Max trades the picture for training speed: while it trains, the viewport
 * stops drawing and the ghost replay stands still, so every core goes to
 * the sim workers. Pausing or picking another speed brings both back.
 */
export function viewportHeld(s: { speed: SpeedMode; status: TrainingStatus; mode: 'train' | 'sandbox' }): boolean {
  return s.speed === 'max' && s.status === 'running' && s.mode === 'train';
}
