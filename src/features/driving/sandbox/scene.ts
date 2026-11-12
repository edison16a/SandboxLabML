import { loadDrivingModels } from '@/engine/bench/driving/models';
import type { SandboxTrip } from '@/engine/driving/sandbox';
import type { WorkerPool } from '@/workers/client/workerPool';
import { isWatchSpeed, WATCH_SPEEDS } from '@/workers/shared/protocol';
import { selectGhosts } from '@/features/lab/session/ghostSelection';
import { useDrivingLab } from '../state/labStore';
import { fieldFromGenerations, STARTING_FIELD } from './field';
import { checkedTrip, sandboxScene } from './firstTrip';
import { pickModel, trainedModel } from './model';
import { firstSandbox, type DrivingSandbox } from './state';

const store = () => useDrivingLab.getState();

/** The parts of the session the Sandbox needs, kept narrow to avoid an import cycle. */
interface SandboxHost {
  pause(): Promise<void>;
}

/**
 * Loads the shipped trained model once, then replays the Sandbox if it was
 * waiting for it. When the file cannot be loaded (offline, or a build that
 * ships none) the Sandbox says so and drives the run's champions instead,
 * if it has any. The next opening of the Sandbox tries again.
 */
function ensureTrained(pool: WorkerPool): void {
  const { trained, trainedLoad } = store();
  if (trained || trainedLoad === 'loading') return;
  store().set({ trainedLoad: 'loading' });
  void loadDrivingModels().then((models) => {
    const model = pickModel(models, store().run);
    if (store().trained) return;
    if (!model) {
      store().set({ trainedLoad: 'failed' });
      const sb = store().sandbox;
      if (sb?.model && sb.field.length > 0) sandboxControls(pool).update({ model: false });
      return;
    }
    store().set({ trained: trainedModel(model), trainedLoad: 'ready' });
    if (store().sandbox?.model) scheduleSandboxScene(pool, 0);
  });
}

/**
 * Pauses training and opens the Sandbox. The first time for a run it
 * starts on the level and city training is on, with a spread of the run's
 * champions, or the trained model when nothing is trained yet. After that
 * it comes back to whatever the user last set up.
 */
export async function enterSandbox(session: SandboxHost, pool: WorkerPool): Promise<void> {
  if (!store().run) return;
  if (store().status === 'running') await session.pause();
  ensureTrained(pool);
  // Read after pausing: the pause flushes generations still waiting to reach the store.
  const s = store();
  const last = s.records.length - 1;
  const kept = s.sandbox?.field.filter((e) => e.generation <= last) ?? [];
  const field = kept.length ? kept : fieldFromGenerations(selectGhosts(s.ghostSelection, s.records.length), STARTING_FIELD);
  const sandbox: DrivingSandbox = s.sandbox ? { ...s.sandbox, field } : firstSandbox(s.content, field);
  s.set({ mode: 'sandbox', sandbox, sandboxPaused: false, view: 'overlay', lesions: {}, focus: { kind: 'champion' } });
  await sendSandboxScene(pool);
}

let timer: ReturnType<typeof setTimeout> | null = null;

/** Sends the Sandbox scene after a short pause, so a burst of changes restarts the replay once. */
export function scheduleSandboxScene(pool: WorkerPool, delay = 120): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void sendSandboxScene(pool), delay);
}

/** Replay rate: the watch speed picked in the toolbar, or real time under Turbo and Max. */
function replaySpeed(): number {
  const { speed } = store();
  return isWatchSpeed(speed) ? WATCH_SPEEDS[speed] : 1;
}

/**
 * Moves a first trip that still needs a check onto a route every copy of
 * the trained model arrives on. Gives the Sandbox to send, or null when
 * the Sandbox changed during the check, since the change sends its own scene.
 * While it checks, the replay training left behind stops and clears, so
 * no stale SUV drives on screen, and the Sandbox bar says what it is doing.
 */
async function checkFirstTrip(pool: WorkerPool, sb: DrivingSandbox): Promise<DrivingSandbox | null> {
  const trained = store().trained;
  if (!sb.checkTrip || !sb.model || !trained) return sb;
  store().set({ sandboxChecking: true });
  let trip: SandboxTrip;
  try {
    await pool.replay.stopGhosts();
    pool.ghosts.clear();
    trip = await checkedTrip(sb.trip, trained, sb.modelCopies, (setup, specs) => pool.replay.rehearse('driving', setup, specs));
  } finally {
    store().set({ sandboxChecking: false });
  }
  if (store().mode !== 'sandbox' || store().sandbox !== sb) return null;
  const checked = { ...sb, trip, checkTrip: false };
  store().set({ sandbox: checked });
  return checked;
}

/**
 * Sends the Sandbox scene to the replay worker: the field (or the trained
 * model) lined up on the chosen trip, with any lesioned inputs forced, and
 * notes in the store what the viewport has to build for it.
 */
export async function sendSandboxScene(pool: WorkerPool): Promise<void> {
  if (store().mode !== 'sandbox' || !store().sandbox) return;
  const sb = await checkFirstTrip(pool, store().sandbox as DrivingSandbox);
  const s = store();
  if (!sb || !s.run) return;
  const trained = sb.model ? s.trained : null;
  const { setup, specs } = sandboxScene(sb, s.run, s.records, trained, s.lesions);
  await pool.replay.setGhostScene('driving', setup, specs);
  // The Sandbox may have closed while the scene loaded.
  if (store().mode !== 'sandbox') return;
  store().set({
    ghostGenerations: specs.map((g) => g.generation),
    sandboxSetup: setup.trips[0],
    sandboxInputs: setup.inputs,
    sandboxBrain: trained ? { run: trained.run, genome: trained.genome, label: trained.label } : null,
    sandboxPaused: false,
  });
  if (!specs.length) {
    await pool.replay.stopGhosts();
    pool.ghosts.clear();
  } else await pool.replay.playGhosts(replaySpeed(), true);
}

/** What the Sandbox panel drives. Training never runs through any of it. */
export interface SandboxControls {
  setPaused(paused: boolean): Promise<void>;
  /** Puts every SUV back at the start and plays the trip again. */
  restart(): Promise<void>;
  update(patch: Partial<DrivingSandbox>): void;
  setTrip(patch: Partial<SandboxTrip>): void;
}

export function sandboxControls(pool: WorkerPool): SandboxControls {
  const update = (patch: Partial<DrivingSandbox>) => {
    const sb = store().sandbox;
    if (!sb) return;
    store().set({ sandbox: { ...sb, ...patch } });
    scheduleSandboxScene(pool, 60);
  };
  return {
    async setPaused(paused) {
      store().set({ sandboxPaused: paused });
      await pool.replay.setGhostsPaused(paused);
    },
    async restart() {
      store().set({ sandboxPaused: false });
      await pool.replay.playGhosts(replaySpeed(), true);
    },
    update,
    setTrip(patch) {
      const sb = store().sandbox;
      if (sb) update({ trip: { ...sb.trip, ...patch }, checkTrip: false });
    },
  };
}
