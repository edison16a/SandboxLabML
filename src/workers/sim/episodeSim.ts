import { mixSeed } from '@/engine/core/rng';
import type { EpisodeEnv, EpisodeResult, EpisodeSetup } from '@/engine/env/episode';
import { requireEpisodeModule } from '@/engine/env/registry';
import { Network } from '@/engine/neat/network';
import type { Genome } from '@/engine/neat/types';
import { hostFor, type ScriptHost } from '@/engine/training/scriptHost';
import { Pacer } from '../shared/pacer';
import type { StreamSender } from '../shared/streamPort';
import { writeFrame } from './frame';

/** Salt of the controller seed for training episodes. Ghost replays use their own. */
export const TRAINING_CONTROLLER_SALT = 0x51;

export interface LiveEpisodeRequest {
  env: string;
  setup: EpisodeSetup;
  genomes: Genome[];
  seeds: number[];
  generation: number;
  speed: number;
  /** Species id per agent, for coloring. */
  tags: number[];
}

/**
 * Any registered episode env inside a sim worker. Headless batches return
 * results as fast as possible; a live run paces itself to real time and
 * streams every agent's snapshot, plus the env's world block, to the main
 * thread.
 */
export class EpisodeSim {
  private host: { source: string | null; host: ScriptHost } | null = null;
  private live: Pacer | null = null;
  /** Settles the live run's promise with no results, so a coordinator waiting on a stopped run moves on. */
  private abandon: (() => void) | null = null;

  private hostFor(source: string | null): ScriptHost {
    if (!this.host || this.host.source !== source) this.host = { source, host: hostFor(source) };
    return this.host.host;
  }

  private create(env: string, setup: EpisodeSetup, genomes: Genome[], seeds: number[], generation: number): EpisodeEnv {
    const episode = requireEpisodeModule(env).createEnv(setup, this.hostFor(setup.scriptSource), mixSeed(generation, TRAINING_CONTROLLER_SALT));
    episode.reset(
      genomes.map((g) => new Network(g)),
      seeds,
    );
    return episode;
  }

  evaluate(env: string, setup: EpisodeSetup, genomes: Genome[], seeds: number[], generation: number): EpisodeResult[] {
    const episode = this.create(env, setup, genomes, seeds, generation);
    while (!episode.done) episode.step();
    return episode.results();
  }

  runLive(req: LiveEpisodeRequest, stream: StreamSender): Promise<EpisodeResult[]> {
    this.stopLive();
    const envModule = requireEpisodeModule(req.env);
    const episode = this.create(req.env, req.setup, req.genomes, req.seeds, req.generation);
    const count = req.genomes.length;
    const stride = envModule.snapshot.stride;
    stream.ring.resize(count * stride + episode.worldFloats);
    stream.send({ kind: 'start', stream: 'population', generation: req.generation, count, tags: Int32Array.from(req.tags), world: episode.worldFloats });
    const send = () => writeFrame(episode, stride, envModule.outputs.length, stream, req.generation);

    return new Promise((resolve) => {
      this.abandon = () => resolve([]);
      const pacer = new Pacer(
        req.speed,
        envModule.tickHz,
        (n) => {
          for (let k = 0; k < n && !episode.done; k++) episode.step();
          return !episode.done;
        },
        send,
        () => {
          send();
          stream.send({ kind: 'end', stream: 'population', generation: req.generation });
          if (this.live === pacer) {
            this.live = null;
            this.abandon = null;
          }
          resolve(episode.results());
        },
      );
      this.live = pacer;
      pacer.start();
    });
  }

  setSpeed(speed: number): void {
    this.live?.setSpeed(speed);
  }

  setPaused(paused: boolean): void {
    this.live?.setPaused(paused);
  }

  /** Stops the live run. Its promise settles with no results, which the coordinator reads as "stopped part way". */
  stopLive(): void {
    this.live?.stop();
    this.live = null;
    const abandon = this.abandon;
    this.abandon = null;
    abandon?.();
  }
}
