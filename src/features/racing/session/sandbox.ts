import { racingSetupFor } from '@/engine/training/racingSetup';
import { scriptAt } from '@/engine/training/runConfig';
import type { WorkerPool } from '@/workers/client/workerPool';
import { selectGhosts } from './ghostSelection';
import { useRacingLab } from '../state/labStore';

/** The parts of the session the Sandbox needs, kept narrow to avoid an import cycle. */
interface SandboxHost {
  pause(): Promise<void>;
}

/** Pauses training and sends a copy of the current track to the replay worker. */
export async function enterSandbox(session: SandboxHost, pool: WorkerPool): Promise<void> {
  const s = useRacingLab.getState();
  if (!s.run?.racing) return;
  if (s.status === 'running') await session.pause();
  s.set({ mode: 'sandbox', sandboxTrack: structuredClone(s.trackSpec ?? s.run.racing.track), view: 'overlay', lesions: {}, focus: { kind: 'champion' } });
  await sendSandboxScene(pool);
}

let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * Sends the Sandbox scene to the replay worker: the chosen champions on the
 * draft track, with any lesioned inputs forced. Debounced, so dragging a
 * track point restarts the replay at most a few times a second.
 */
export function scheduleSandboxScene(pool: WorkerPool, delay = 160): void {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => void sendSandboxScene(pool), delay);
}

export async function sendSandboxScene(pool: WorkerPool): Promise<void> {
  const s = useRacingLab.getState();
  if (s.mode !== 'sandbox' || !s.run || !s.sandboxTrack) return;
  const run = s.run;
  const gens = selectGhosts(s.ghostSelection, s.records.length);
  const byGen = new Map(s.records.map((r) => [r.generation, r]));
  const specs = gens
    .map((g) => byGen.get(g))
    .filter((r) => r !== undefined)
    .map((r) => ({ generation: r.generation, genome: r.genome, seed: r.replaySeed, scriptSource: scriptAt(run, r.generation)?.source ?? null }));
  const setup = racingSetupFor(run, s.sandboxTrack, null);
  const lesion = Object.entries(s.lesions).map(([k, v]) => [Number(k), v] as [number, number]);
  await pool.replay.setGhostScene({ ...setup, lesion: lesion.length ? lesion : undefined }, specs);
  s.set({ ghostGenerations: gens });
  await pool.replay.playGhosts(1, true);
  s.set({ telemetry: await pool.replay.ghostTelemetry() });
}
