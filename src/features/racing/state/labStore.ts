import { create } from 'zustand';
import type { GenerationRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import type { TrackSpec } from '@/engine/racing/track/types';
import type { TrainingStatus } from '@/workers/coordinator/events';
import type { SpeedMode } from '@/workers/shared/protocol';
import type { GhostTelemetry } from '@/workers/replay/ghostPlayer';
import type { GhostSelection } from '../session/ghostSelection';

export type ViewMode = 'population' | 'overlay' | 'both';
export type CameraMode = 'chase' | 'orbit' | 'top' | 'free';
export type QualityTier = 'low' | 'medium' | 'high';
export type QualitySetting = QualityTier | 'auto';

/** What the camera follows and what the inputs overlay inspects. */
export type Focus = { kind: 'champion' } | { kind: 'car'; index: number } | { kind: 'ghost'; generation: number };

export type PanelTab = 'progress' | 'network' | 'species' | 'inputs' | 'model';

/**
 * UI state for the Racing lab. High-frequency data (snapshots) never goes
 * through here; it flows from the workers straight to the renderer. This
 * store only holds things React needs to re-render for.
 */
export interface RacingLabState {
  run: RunConfig | null;
  /** Track the cars currently drive on. Usually the run's track; scripts can switch it. */
  trackSpec: TrackSpec | null;
  status: TrainingStatus;
  speed: SpeedMode;
  records: GenerationRecord[];
  liveGeneration: number;
  /** Set when stored ghosts cannot be replayed under the current engine. */
  replayBlocked: string | null;

  view: ViewMode;
  ghostSelection: GhostSelection;
  ghostTrails: boolean;
  ghostCrashRings: boolean;
  brakeMap: boolean;
  ghostGenerations: number[];
  telemetry: GhostTelemetry[];
  hoveredGhost: number | null;

  camera: CameraMode;
  focus: Focus;
  quality: QualitySetting;
  activeTier: QualityTier;
  inputsOverlay: boolean;
  inputsScope: 'selected' | 'all';
  hoveredInput: number | null;
  panelTab: PanelTab;
  /** Generation shown in the network view; null follows the latest. */
  networkGeneration: number | null;
  editingTrack: boolean;
  /** Train runs the population; Sandbox replays champions on an editable track. */
  mode: 'train' | 'sandbox';
  sandboxTrack: TrackSpec | null;
  /** Lesion test: input index mapped to the value it is forced to. Sandbox only. */
  lesions: Record<number, number>;
  selectedHandle: number | null;
  /** Bumped by the help menu to replay the tour. */
  tourSignal: number;

  set: (patch: Partial<RacingLabState>) => void;
  addRecord: (record: GenerationRecord) => void;
}

export const useRacingLab = create<RacingLabState>((set, get) => ({
  run: null,
  trackSpec: null,
  status: 'idle',
  speed: '1x',
  records: [],
  liveGeneration: 0,
  replayBlocked: null,

  view: 'both',
  ghostSelection: { mode: 'auto' },
  ghostTrails: true,
  ghostCrashRings: true,
  brakeMap: true,
  ghostGenerations: [],
  telemetry: [],
  hoveredGhost: null,

  camera: 'chase',
  focus: { kind: 'champion' },
  quality: 'auto',
  activeTier: 'high',
  inputsOverlay: false,
  inputsScope: 'selected',
  hoveredInput: null,
  panelTab: 'progress',
  networkGeneration: null,
  editingTrack: false,
  mode: 'train',
  sandboxTrack: null,
  lesions: {},
  selectedHandle: null,
  tourSignal: 0,

  set: (patch) => set(patch),
  addRecord: (record) => {
    const records = get().records;
    // Records can arrive again after a resume from an older checkpoint; replace in place.
    const next = records.length && records[records.length - 1].generation >= record.generation
      ? [...records.filter((r) => r.generation < record.generation), record]
      : [...records, record];
    set({ records: next, liveGeneration: record.generation + 1 });
  },
}));
