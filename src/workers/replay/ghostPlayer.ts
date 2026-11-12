import type { AnyEpisodeModule, EpisodeSetup } from '@/engine/env/episode';
import { loadEpisodeModule } from '@/engine/env/registry';
import { Pacer } from '../shared/pacer';
import type { StreamSender } from '../shared/streamPort';
import { GhostFrames, type GhostGroup } from './ghostFrames';
import { ghostGroups, type GhostSpec } from './ghostEnvs';

export type { GhostSpec } from './ghostEnvs';

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
  private run = 0;
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
   * start would run, so the run itself does not change.
   */
  play(speed: number, loop: boolean, warmup = 0): void {
    this.stop();
    this.paused = false;
    this.speed = speed;
    this.warmup = warmup;
    const envModule = this.module;
    if (!envModule || !this.setup || this.ghosts.length === 0) return;
    this.loop = loop;
    this.build();
    for (let k = 0; k < warmup; k++) for (const e of this.envs) if (!e.env.done) e.env.step();
    const runId = ++this.run;
    this.frames.start(envModule, this.envs, this.ghosts.map((g) => g.generation));
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
        if (this.loop && runId === this.run) setTimeout(() => runId === this.run && this.replay(), 1200);
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
  }

  /**
   * The loop's own restart. It keeps the speed picked since the loop began,
   * and a pause pressed during the gap between runs still holds afterwards.
   */
  private replay(): void {
    const paused = this.paused;
    this.play(this.speed, true, this.warmup);
    if (paused) this.setPaused(true);
  }

  /** Stops the replay, including a loop restart still waiting out the gap between runs. */
  stop(): void {
    this.run++;
    this.pacer?.stop();
    this.pacer = null;
  }

  private build(): void {
    this.envs = ghostGroups(this.module as AnyEpisodeModule, this.setup as EpisodeSetup, this.ghosts);
  }
}
