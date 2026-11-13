import type { AnyEpisodeModule, EpisodeSetup } from '@/engine/env/episode';
import { loadEpisodeModule } from '@/engine/env/registry';
import { Pacer } from '../shared/pacer';
import type { StreamSender } from '../shared/streamPort';
import { GhostFrames, type GhostGroup } from './ghostFrames';
import { ghostGroups, type GhostSpec } from './ghostEnvs';

export type { GhostSpec } from './ghostEnvs';

/** How long a looping replay rests on its last frame before it starts over, ms. */
export const LOOP_GAP_MS = 1200;

/**
 * Re-simulates stored champions of any episode env as ghosts. Ghosts are
 * driven by the same env code as training, so they reproduce their
 * original runs exactly. Ghosts trained under different script versions
 * get separate envs, stepped in lockstep and merged into one stream.
 */
export class GhostPlayer {
  private module: AnyEpisodeModule | null = null;
  private setup: EpisodeSetup | null = null;
  private ghosts: GhostSpec[] = [];
  private envs: GhostGroup[] = [];
  private readonly frames: GhostFrames;
  private pacer: Pacer | null = null;
  private loop = true;
  private paused = false;
  private speed = 1;
  /** Ticks every run skips before it is shown. See play. */
  private warmup = 0;
  /** The rest between loops. See play. */
  private gap = LOOP_GAP_MS;
  private run = 0;
  /** A loop restart that came due while paused. It waits for the resume, so a paused finished run stays on screen. */
  private pendingReplay = false;
  /** Counts setScene calls, so an older scene that finishes loading late is dropped. */
  private scenes = 0;

  constructor(private readonly stream: StreamSender) {
    this.frames = new GhostFrames(stream);
  }

  /**
   * The env, its setup (such as the trip to drive) and the champions to
   * replay on it. Loads the env's module first, so the scene only changes
   * once the player can run it.
   */
  async setScene(env: string, setup: EpisodeSetup, ghosts: GhostSpec[]): Promise<void> {
    const scene = ++this.scenes;
    const envModule = await loadEpisodeModule(env);
    // A later scene asked for while this one loaded wins.
    if (scene !== this.scenes) return;
    this.module = envModule;
    this.setup = setup;
    this.ghosts = ghosts;
  }

  /**
   * Restarts every ghost from its grid slot at `speed` times real time.
   * `warmup` ticks are simulated before the first frame, so a showcase can
   * open on an agent already under way. The ticks are the same ones a cold
   * start would run, so the run itself does not change. A loop rests `gap`
   * ms on the last frame before it starts over: a Sandbox rests longer, so
   * the finished trip can be read. The lineup goes out with the start, so
   * the screen never holds a run that has no frame yet, even one that
   * opens paused.
   */
  play(speed: number, loop: boolean, warmup = 0, gap = LOOP_GAP_MS): void {
    this.stop();
    this.paused = false;
    this.speed = speed;
    this.warmup = warmup;
    this.gap = gap;
    const envModule = this.module;
    if (!envModule || !this.setup || this.ghosts.length === 0) return;
    this.loop = loop;
    this.build();
    for (let k = 0; k < warmup; k++) for (const e of this.envs) if (!e.env.done) e.env.step();
    const runId = ++this.run;
    this.frames.start(envModule, this.envs, this.ghosts.map((g) => g.generation));
    this.frames.send(this.envs, true);
    const pacer = new Pacer(
      speed,
      envModule.tickHz,
      (n) => {
        for (let k = 0; k < n; k++) {
          let alive = false;
          for (const e of this.envs) {
            if (!e.env.done) e.env.step();
            alive ||= !e.env.done;
          }
          if (!alive) return false;
        }
        return true;
      },
      () => this.frames.send(this.envs),
      () => {
        this.frames.send(this.envs);
        if (this.loop && runId === this.run) setTimeout(() => runId === this.run && this.loopDue(), this.gap);
      },
    );
    this.pacer = pacer;
    pacer.start();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.pacer?.setSpeed(speed);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.pacer?.setPaused(paused);
    if (!paused && this.pendingReplay) this.replay();
  }

  /**
   * The gap after a finished run is over. A pause pressed during it holds
   * the finished run on screen until the user resumes, rather than
   * starting the next run frozen at the start line.
   */
  private loopDue(): void {
    if (this.paused) this.pendingReplay = true;
    else this.replay();
  }

  /** The loop's own restart. It keeps the speed picked since the loop began. */
  private replay(): void {
    this.play(this.speed, true, this.warmup, this.gap);
  }

  /** Stops the replay, including a loop restart still waiting out the gap between runs or a pause. */
  stop(): void {
    this.run++;
    this.pendingReplay = false;
    this.pacer?.stop();
    this.pacer = null;
  }

  private build(): void {
    this.envs = ghostGroups(this.module as AnyEpisodeModule, this.setup as EpisodeSetup, this.ghosts);
  }
}
