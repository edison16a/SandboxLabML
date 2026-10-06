import type { Remote } from 'comlink';
import type { RacingResult } from '@/engine/racing/episode';
import type { RunConfig } from '@/engine/training/runConfig';
import { RacingTrainer, type RacingTrainerState } from '@/engine/training/racingTrainer';
import { isWatchSpeed, WATCH_SPEEDS, type SpeedMode } from '../shared/protocol';
import type { SimApi } from '../sim/sim.worker';
import type { EventSink } from './events';

/** How often a checkpoint of the whole population is saved, in generations. */
const CHECKPOINT_EVERY = 10;

/**
 * Drives racing training across the sim workers. Watch speeds run the whole
 * generation live in sim worker 0; Turbo and Max split the population across
 * every worker and run headless.
 */
export class RacingCoordinator {
  private trainer: RacingTrainer;
  private speed: SpeedMode = '1x';
  private running = false;
  private pauseRequested = false;
  private stepsLeft = Infinity;
  private loopPromise: Promise<void> | null = null;
  private readonly emit: EventSink;
  private readonly sims: Remote<SimApi>[];

  constructor(config: RunConfig, sims: Remote<SimApi>[], emit: EventSink, state?: RacingTrainerState) {
    this.trainer = new RacingTrainer(config, state);
    this.sims = sims;
    this.emit = emit;
  }

  get generation(): number {
    return this.trainer.generation;
  }

  setSpeed(mode: SpeedMode): void {
    this.speed = mode;
    void this.sims[0].setSpeed(WATCH_SPEEDS[mode]);
  }

  /** Starts or resumes training. `generations` limits how many to run (used by "step"). */
  start(generations = Infinity): void {
    this.stepsLeft = generations;
    this.pauseRequested = false;
    void this.sims[0].setPaused(false);
    if (this.running) return;
    this.running = true;
    this.emit({ type: 'status', status: 'running' });
    this.loopPromise = this.loop();
  }

  /** Pauses immediately in watch mode, or after the current batch in Turbo. */
  pause(): void {
    this.pauseRequested = true;
    void this.sims[0].setPaused(true);
    if (this.running) this.emit({ type: 'status', status: 'paused' });
  }

  async stop(): Promise<void> {
    this.pauseRequested = true;
    await this.sims[0].stopLive();
    await this.loopPromise;
  }

  checkpoint(): RacingTrainerState {
    return this.trainer.toState();
  }

  private async loop(): Promise<void> {
    try {
      while (!this.pauseRequested && this.stepsLeft > 0) {
        await this.runGeneration();
        this.stepsLeft--;
      }
    } catch (err) {
      this.emit({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      this.running = false;
      this.emit({ type: 'status', status: this.pauseRequested || this.stepsLeft <= 0 ? 'paused' : 'idle' });
    }
  }

  private async runGeneration(): Promise<void> {
    const t = this.trainer;
    const started = performance.now();
    const setup = t.setup();
    const genomes = t.genomes;
    const seeds = t.seeds();
    const generation = t.generation;
    let results: RacingResult[];
    if (isWatchSpeed(this.speed)) {
      this.emit({ type: 'live-start', generation, speed: WATCH_SPEEDS[this.speed] });
      const tags = genomes.map((g) => g.speciesId);
      results = await this.sims[0].runRacingLive({ setup, genomes, seeds, generation, speed: WATCH_SPEEDS[this.speed], tags });
    } else {
      const chunk = Math.ceil(genomes.length / this.sims.length);
      const parts = await Promise.all(
        this.sims.map((sim, i) => {
          const slice = genomes.slice(i * chunk, (i + 1) * chunk);
          return slice.length ? sim.evaluateRacing(setup, slice, seeds.slice(i * chunk, (i + 1) * chunk), generation) : [];
        }),
      );
      results = parts.flat();
    }
    if (results.length !== genomes.length) return; // live run was stopped part way
    const record = t.complete(results, performance.now() - started);
    this.emit({ type: 'generation', record });
    if (t.generation % CHECKPOINT_EVERY === 0) this.emit({ type: 'checkpoint', generation: t.generation, state: t.toState() });
  }
}
