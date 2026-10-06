import type { TrackSpec } from '@/engine/racing/track/types';
import { racingSetupFor } from '@/engine/training/racingSetup';
import type { WorkerPool } from '@/workers/client/workerPool';
import { isWatchSpeed, WATCH_SPEEDS } from '@/workers/shared/protocol';
import { fieldFromGenerations, fieldScene, type FieldEntry } from './field';
import { selectGhosts } from './ghostSelection';
import { useRacingLab } from '../state/labStore';

/** The parts of the session the Sandbox needs, kept narrow to avoid an import cycle. */
interface SandboxHost {
  pause(): Promise<void>;
}

/**
 * Pauses training and opens the Sandbox. The first time for a run it starts
 * on a copy of the run's track with the ghost picks as the field; after
 * that it comes back to whatever the user last set up.
 */
export async function enterSandbox(session: SandboxHost, pool: WorkerPool): Promise<void> {
  const s = useRacingLab.getState();
  if (!s.run?.racing) return;
  if (s.status === 'running') await session.pause();
  const last = s.records.length - 1;
  const kept = s.sandboxField.filter((e) => e.generation <= last);
  const first = s.sandboxTrack ? null : structuredClone(s.trackSpec ?? s.run.racing.track);
  s.set({
    mode: 'sandbox',
    ...(first && { sandboxTrack: first, sandboxPicked: first }),
    sandboxField: kept.length ? kept : fieldFromGenerations(selectGhosts(s.ghostSelection, s.records.length)),
    view: 'overlay',
    lesions: {},
    focus: { kind: 'champion' },
  });
  await sendSandboxScene(pool);
}

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Sends the Sandbox scene to the replay worker: the field on the chosen
 * track, with any lesioned inputs forced. Debounced, so dragging a track
 * point restarts the race at most a few times a second.
 */
export function scheduleSandboxScene(pool: WorkerPool, delay = 160): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void sendSandboxScene(pool), delay);
}

/** Replay rate for the Sandbox: the watch speed picked in the toolbar, or real time under Turbo and Max. */
function replaySpeed(): number {
  const { speed } = useRacingLab.getState();
  return isWatchSpeed(speed) ? WATCH_SPEEDS[speed] : 1;
}

export async function sendSandboxScene(pool: WorkerPool): Promise<void> {
  const s = useRacingLab.getState();
  if (s.mode !== 'sandbox' || !s.run || !s.sandboxTrack) return;
  const { specs, generations } = fieldScene(s.run, s.records, s.sandboxField);
  const setup = racingSetupFor(s.run, s.sandboxTrack, null);
  const lesion = Object.entries(s.lesions).map(([k, v]) => [Number(k), v] as [number, number]);
  await pool.replay.setGhostScene({ ...setup, lesion: lesion.length ? lesion : undefined }, specs);
  s.set({ ghostGenerations: generations, sandboxPaused: false });
  if (!specs.length) {
    await pool.replay.stopGhosts();
    pool.ghosts.clear();
  } else await pool.replay.playGhosts(replaySpeed(), true);
  s.set({ telemetry: await pool.replay.ghostTelemetry() });
}

/** What the Sandbox panel drives. Training never runs through any of it. */
export interface SandboxControls {
  setPaused(paused: boolean): Promise<void>;
  /** Puts every car back on the grid and starts the race again. */
  restart(): Promise<void>;
  setField(field: FieldEntry[]): void;
  /** Races on a track picked from the gallery, which also becomes the base edits are measured against. */
  setTrack(spec: TrackSpec): void;
}

export function sandboxControls(pool: WorkerPool): SandboxControls {
  const store = () => useRacingLab.getState();
  return {
    async setPaused(paused) {
      store().set({ sandboxPaused: paused });
      await pool.replay.setGhostsPaused(paused);
    },
    async restart() {
      store().set({ sandboxPaused: false });
      await pool.replay.playGhosts(replaySpeed(), true);
    },
    setField(field) {
      store().set({ sandboxField: field });
      scheduleSandboxScene(pool, 60);
    },
    setTrack(spec) {
      store().set({ sandboxTrack: spec, sandboxPicked: spec, selectedHandle: null });
      scheduleSandboxScene(pool, 60);
    },
  };
}
