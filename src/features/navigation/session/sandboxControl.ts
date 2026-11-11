import { loadReferences } from '@/engine/bench/references';
import type { CourseSpec } from '@/engine/navigation/course/types';
import { navigationInputSchema } from '@/engine/navigation/sensors/inputSchema';
import { deleteCourse, listCourses, saveCourse } from '@/storage/courses';
import { toast } from '@/ui/toast/toastStore';
import type { WorkerPool } from '@/workers/client/workerPool';
import { isWatchSpeed, WATCH_SPEEDS } from '@/workers/shared/protocol';
import { useNavigationLab } from '../state/labStore';
import { SANDBOX_SEED, STARTING_COPIES, type FieldEntry, type NavSandbox, type SandboxCourse } from '../state/sandboxState';
import { sandboxLineup, sandboxScene } from './sandboxScene';

const store = () => useNavigationLab.getState();

/** Replay rate: the watch speed picked in the toolbar, or real time under Turbo and Max. */
function replaySpeed(): number {
  const { speed } = store();
  return isWatchSpeed(speed) ? WATCH_SPEEDS[speed] : 1;
}

/**
 * The Navigation Sandbox: trained runners on any course, played in the
 * replay worker while training waits. Runners are the run's champions, as
 * many copies as the user likes, or a model shipped with the app. Every
 * change rebuilds the scene; nothing here touches training.
 */
export class SandboxControl {
  private loaded: Promise<void> | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly pool: WorkerPool,
    private readonly pause: () => Promise<void>,
  ) {}

  /** Reads the user's courses and the shipped models once per page load. Either may fail; the Sandbox works without them. */
  private load(): Promise<void> {
    this.loaded ??= Promise.all([listCourses().catch(() => [] as CourseSpec[]), loadReferences('navigation')]).then(([saved, refs]) => store().setSandbox({ saved, models: refs?.models ?? [] }));
    return this.loaded;
  }

  /**
   * Opens the Sandbox. The first time it lines up copies of the newest
   * champion on a course of the level training is on, or the shipped
   * Advanced model when nothing is trained yet. Later it comes back to
   * the last setup, keeping only champions this run still has.
   */
  async enter(): Promise<void> {
    if (store().status === 'running') await this.pause();
    await this.load();
    const s = store();
    if (!s.run) return;
    const last = s.records.length - 1;
    const kept = s.sandbox.field.filter((e) => e.generation <= last);
    const field: FieldEntry[] = kept.length ? kept : last >= 0 ? [{ generation: last, copies: STARTING_COPIES }] : [];
    const first = s.sandbox.field.length === 0 && s.sandbox.course.kind === 'level' && s.sandbox.course.seed === SANDBOX_SEED;
    const course: SandboxCourse = first ? { kind: 'level', level: Math.max(1, s.content?.curriculum.level ?? 1), seed: SANDBOX_SEED } : s.sandbox.course;
    const source = last < 0 ? 'model' : s.sandbox.source;
    s.setSandbox({ field, course, source, paused: false });
    s.set({ mode: 'sandbox', focus: { kind: 'champion' }, lesions: {} });
    await this.send();
  }

  /** Changes the setup and plays it from the start. */
  configure(patch: Partial<Pick<NavSandbox, 'course' | 'source' | 'field' | 'model' | 'modelCopies'>>): void {
    store().setSandbox({ ...patch, paused: false });
    this.schedule();
  }

  /** A new layout of the picked level, so the same runners meet a room they have never seen. */
  newLayout(): void {
    const c = store().sandbox.course;
    if (c.kind === 'level') this.configure({ course: { ...c, seed: c.seed + 1 } });
  }

  async setPaused(paused: boolean): Promise<void> {
    store().setSandbox({ paused });
    await this.pool.replay.setGhostsPaused(paused);
  }

  /** Puts every runner back on the grid and starts again. */
  async restart(): Promise<void> {
    store().setSandbox({ paused: false });
    await this.pool.replay.playGhosts(replaySpeed(), true);
  }

  /** Saves a course the user drew and runs it. Returns false when storage refused, so the editor keeps the work. */
  async saveCourse(spec: CourseSpec): Promise<boolean> {
    try {
      const clean = await saveCourse(spec);
      const saved = store().sandbox.saved;
      store().setSandbox({ saved: saved.some((c) => c.id === clean.id) ? saved.map((c) => (c.id === clean.id ? clean : c)) : [...saved, clean] });
      this.configure({ course: { kind: 'saved', id: clean.id } });
      return true;
    } catch (err) {
      toast.error('Could not save the course', `Your edits are still in the editor. ${err instanceof Error ? err.message : String(err)}`);
      return false;
    }
  }

  /** Deletes a drawn course, with an Undo that stores it again. If it was in play, level 1 takes its place. */
  async deleteCourse(id: string): Promise<void> {
    try {
      await deleteCourse(id);
      const s = store().sandbox;
      const gone = s.saved.find((c) => c.id === id);
      store().setSandbox({ saved: s.saved.filter((c) => c.id !== id) });
      if (s.course.kind === 'saved' && s.course.id === id) this.configure({ course: { kind: 'level', level: 1, seed: SANDBOX_SEED } });
      if (gone) toast.withAction(`Deleted ${gone.name}`, { label: 'Undo', onClick: () => void this.saveCourse(gone) });
    } catch (err) {
      toast.error('Could not delete the course', err instanceof Error ? err.message : String(err));
    }
  }

  /** Rebuilds the scene a moment after the last change, so a burst of clicks on a stepper restarts it once. */
  schedule(delay = 80): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.send(), delay);
  }

  /** Sends the scene to the replay worker and plays it, or clears the view when nothing is lined up. */
  async send(): Promise<void> {
    const s = store();
    if (s.mode !== 'sandbox' || !s.run) return;
    const scene = sandboxScene(s.run, s.records, s.sandbox, s.lesions);
    // From here the viewport shows this course and no other, with the runners on their spots until the replay streams.
    s.setSandbox({ inputs: scene?.inputs ?? null, lineup: sandboxLineup(s.run, s.sandbox, scene) });
    // A shipped model reads other inputs than the run's brain, and the inputs panels should label those.
    s.set({ viewSchema: scene?.inputs ? navigationInputSchema(scene.inputs) : null });
    if (!scene) {
      await this.pool.replay.stopGhosts();
      this.pool.ghosts.clear();
      s.set({ ghostGenerations: [] });
      return;
    }
    await this.pool.replay.setGhostScene('navigation', scene.setup, scene.specs);
    s.set({ ghostGenerations: scene.generations });
    await this.pool.replay.playGhosts(replaySpeed(), true);
    if (store().sandbox.paused) await this.pool.replay.setGhostsPaused(true);
  }
}
