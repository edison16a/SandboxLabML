import { create } from 'zustand';
import type { HideSeekRecord } from '@/engine/training/hideseekRecords';
import type { RunConfig } from '@/engine/training/runConfig';
import type { TrainingStatus } from '@/workers/coordinator/events';
import type { SpeedMode } from '@/workers/shared/protocol';
import { qualityChosen, type SettingsState } from '@/features/settings/settingsStore';
import type { AgentSlot, FeedSource, GridSize, HsCamera, HsPanelTab, HsQualityTier, LabMode, RoundInfo, SandboxSettings, Team } from './types';

/**
 * UI state for the Hide and Seek lab. Like the Racing store it never holds
 * per-frame data: arenas stream from the workers straight to the renderer,
 * and this store only holds what React needs to re-render for.
 */
export interface HideSeekLabState {
  run: RunConfig | null;
  status: TrainingStatus;
  speed: SpeedMode;
  records: HideSeekRecord[];
  liveGeneration: number;
  round: RoundInfo | null;
  source: FeedSource;
  /** Generation and round of the replay on screen. */
  replayOf: { generation: number; round: number; rounds: number } | null;
  /** A round replay is playing right now, so the viewport must keep animating. */
  replaying: boolean;
  /** Set when stored brains cannot be replayed under the current engine. */
  replayBlocked: string | null;

  mode: LabMode;
  gridSize: GridSize;
  /** Arena shown in the showcase, or null for the grid overview. */
  focus: number | null;
  camera: HsCamera;
  /** Picture in picture views from both agents' eyes. */
  pov: boolean;
  /** Render tier. Settings own the choice; useHideSeekQuality copies it here for the renderer. */
  activeTier: HsQualityTier;
  effects: boolean;
  photoMode: boolean;
  inputsOverlay: boolean;
  inputsScope: 'focused' | 'all';
  /** Which agent of the focused arena the inputs and network panels follow. */
  inspectAgent: AgentSlot;
  hoveredInput: number | null;
  panelTab: HsPanelTab;
  /** Generation shown in the network view; null follows the latest. */
  networkGeneration: number | null;
  modelTeam: Team;
  sandbox: SandboxSettings;

  set: (patch: Partial<HideSeekLabState>) => void;
  setSandbox: (patch: Partial<SandboxSettings>) => void;
  addRecord: (record: HideSeekRecord) => void;
}

/**
 * Whether the grid stops at 25 arenas. A weak GPU is only capped while
 * nobody has picked a quality: Low is cheap enough for all 50, and someone
 * who picks a tier has chosen the cost themselves. Takes the Settings state.
 */
export function gridCapped(s: Pick<SettingsState, 'weakGpu' | 'pinned' | 'quality'>): boolean {
  return s.weakGpu === true && !qualityChosen(s);
}

export const useHideSeekLab = create<HideSeekLabState>((set, get) => ({
  run: null,
  status: 'idle',
  speed: '1x',
  records: [],
  liveGeneration: 0,
  round: null,
  source: 'live',
  replayOf: null,
  replaying: false,
  replayBlocked: null,

  mode: 'train',
  gridSize: 50,
  focus: null,
  camera: 'orbit',
  pov: true,
  activeTier: 'high',
  effects: true,
  photoMode: false,
  inputsOverlay: false,
  inputsScope: 'all',
  inspectAgent: 1,
  hoveredInput: null,
  panelTab: 'progress',
  networkGeneration: null,
  modelTeam: 'hider',
  sandbox: { hiderGeneration: 0, seekerGeneration: 0, layout: 'shelter', seed: 1, playing: false, lesions: [] },

  set: (patch) => set(patch),
  setSandbox: (patch) => set({ sandbox: { ...get().sandbox, ...patch } }),
  addRecord: (record) => {
    const records = get().records;
    // A resume from an older checkpoint replays generations; replace them in place.
    const next =
      records.length && records[records.length - 1].generation >= record.generation
        ? [...records.filter((r) => r.generation < record.generation), record]
        : [...records, record];
    set({ records: next, liveGeneration: record.generation + 1 });
  },
}));
