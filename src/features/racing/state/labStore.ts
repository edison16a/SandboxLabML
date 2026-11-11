import { create } from 'zustand';
import { ENGINE_VERSION } from '@/engine/core/version';
import type { RacingRecord } from '@/engine/training/records';
import type { RunConfig } from '@/engine/training/runConfig';
import type { TrackSpec } from '@/engine/racing/track/types';
import type { GhostTelemetry } from '@/workers/replay/ghostPlayer';
import { labDefaults, openedLabState, withRecords, type LabState } from '@/features/lab/state/labState';
import type { FieldEntry } from '../session/field';

export { followsGhost, viewportHeld, type Focus, type PanelTab, type QualityTier, type ViewMode } from '@/features/lab/state/labState';

export type CameraMode = 'chase' | 'orbit' | 'trackside' | 'top' | 'free';

/**
 * Lab state for a run that was just opened: the shared fields, plus
 * nothing cached from the run before. `leaving` is the mode the lab was in.
 */
export function openedRunState(run: RunConfig, records: RacingRecord[], liveGeneration: number, leaving: RacingLabState['mode'] = 'train'): Partial<RacingLabState> {
  return {
    ...openedLabState(run, records, liveGeneration, ENGINE_VERSION, leaving),
    records,
    telemetry: [],
    telemetryTrack: null,
    editingTrack: false,
    selectedHandle: null,
    sandboxTrack: null,
    sandboxPicked: null,
    sandboxField: [],
    sandboxPaused: false,
  };
}

const NO_TELEMETRY: GhostTelemetry[] = [];

/**
 * The telemetry measured on the track on screen, or none. A Sandbox track
 * shows up before its race is timed, and until then the old crash points
 * and results would land on the wrong road. Training telemetry carries no
 * track, so Sandbox telemetry left over after leaving it stays hidden too.
 */
export function placedTelemetry(s: Pick<RacingLabState, 'mode' | 'sandboxTrack' | 'telemetry' | 'telemetryTrack'>): GhostTelemetry[] {
  return s.telemetryTrack === (s.mode === 'sandbox' ? s.sandboxTrack : null) ? s.telemetry : NO_TELEMETRY;
}

/**
 * UI state for the Racing lab: the shared lab fields plus the track, the
 * ghost dressing and the Sandbox. High frequency data (snapshots) never
 * goes through here; it flows from the workers straight to the renderer.
 */
export interface RacingLabState extends LabState {
  records: RacingRecord[];
  camera: CameraMode;
  /** Track the cars currently drive on. Usually the run's track; scripts can switch it. */
  trackSpec: TrackSpec | null;
  ghostTrails: boolean;
  ghostCrashRings: boolean;
  brakeMap: boolean;
  telemetry: GhostTelemetry[];
  /** The Sandbox track `telemetry` was timed on, or null when it came from training. */
  telemetryTrack: TrackSpec | null;
  hoveredGhost: number | null;
  editingTrack: boolean;
  sandboxTrack: TrackSpec | null;
  /** The gallery entry the Sandbox track was picked from. Any edit makes the two differ. */
  sandboxPicked: TrackSpec | null;
  /** Champions racing in the Sandbox and how many copies of each. Empty until the Sandbox first opens for a run. */
  sandboxField: FieldEntry[];
  sandboxPaused: boolean;
  selectedHandle: number | null;

  set: (patch: Partial<RacingLabState>) => void;
  /** Appends finished generations, oldest first, in one update. */
  addRecords: (batch: RacingRecord[]) => void;
}

export const useRacingLab = create<RacingLabState>((set, get) => ({
  ...labDefaults('chase'),
  camera: 'chase',
  records: [],
  trackSpec: null,
  ghostTrails: true,
  ghostCrashRings: true,
  brakeMap: false,
  telemetry: [],
  telemetryTrack: null,
  hoveredGhost: null,
  editingTrack: false,
  sandboxTrack: null,
  sandboxPicked: null,
  sandboxField: [],
  sandboxPaused: false,
  selectedHandle: null,

  set: (patch) => set(patch),
  addRecords: (batch) => {
    const next = withRecords(get().records, batch);
    if (next) set(next);
  },
}));
