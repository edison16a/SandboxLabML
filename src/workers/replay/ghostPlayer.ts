import { mixSeed } from '@/engine/core/rng';
import type { AnyEpisodeModule, EpisodeEnv, EpisodeSetup } from '@/engine/env/episode';
import { loadEpisodeModule } from '@/engine/env/registry';
import { Network } from '@/engine/neat/network';
import type { Genome } from '@/engine/neat/types';
import { hostFor } from '@/engine/training/scriptHost';
import { Pacer } from '../shared/pacer';
import type { StreamSender } from '../shared/streamPort';
import { GhostFrames, type GhostGroup } from './ghostFrames';
import { traceGhost, type GhostTelemetry } from './ghostTrace';

export type { GhostTelemetry } from './ghostTrace';

export interface GhostSpec {
  generation: number;
  genome: Genome;
  seed: number;
  scriptSource: string | null;
  /** Start grid slot. Left out, the ghost starts where it trained. */
  slot?: number;
}

/** Salt of a ghost's controller seed. Script rand() in a tick draws from the agent's own stream, so it does not change a lap. */
const GHOST_CONTROLLER_SALT = 0x9405;

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
   * The env, its setup (Racing: the track to drive) and the champions to
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
   * open on a car already at speed. The ticks are the same ones a cold
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

  /**
   * Distance, speed and brake for every ghost, computed headless in one
   * pass. One line per agent, in stream order, so a line's color matches
   * its agent even when a Sandbox grid holds several copies of one
   * champion. Empty for an env without telemetry.
   */
  telemetry(): GhostTelemetry[] {
    const trace = this.module?.telemetry;
    if (!trace || !this.setup) return [];
    return this.ghosts.map((g) => traceGhost(this.makeEnv([g]), trace, g.generation, g.slot ?? 0));
  }

  private makeEnv(ghosts: GhostSpec[]): EpisodeEnv {
    const envModule = this.module as AnyEpisodeModule;
    const source = ghosts[0]?.scriptSource ?? null;
    const env = envModule.createEnv({ ...(this.setup as EpisodeSetup), scriptSource: source }, hostFor(source), mixSeed(GHOST_CONTROLLER_SALT));
    env.reset(
      ghosts.map((g) => new Network(g.genome)),
      ghosts.map((g) => g.seed),
      ghosts.map((g) => g.slot ?? 0),
    );
    return env;
  }

  private build(): void {
    const groups = new Map<string | null, number[]>();
    this.ghosts.forEach((g, i) => {
      const list = groups.get(g.scriptSource);
      if (list) list.push(i);
      else groups.set(g.scriptSource, [i]);
    });
    this.envs = [...groups.values()].map((order) => ({ env: this.makeEnv(order.map((i) => this.ghosts[i])), order }));
  }
}
