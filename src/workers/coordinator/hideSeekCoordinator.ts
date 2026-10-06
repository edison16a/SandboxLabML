import type { Remote } from 'comlink';
import type { MatchResult } from '@/engine/hideseek/match/types';
import { HideSeekTrainer } from '@/engine/hideseek/trainer/trainer';
import type { HideSeekTrainerState } from '@/engine/hideseek/trainer/types';
import type { RunConfig } from '@/engine/training/runConfig';
import { hideSeekScriptSource, hideSeekSensorCounts, hideSeekTrainerOptions, safeHideSeekHost } from '@/engine/training/hideseekSetup';
import { isWatchSpeed, WATCH_SPEEDS, type SpeedMode } from '../shared/protocol';
import type { SimApi } from '../sim/sim.worker';
import type { HideSeekEventSink } from './hideSeekEvents';
import { playHeadless } from './hideSeekFarm';
import { generationRecord, lastRoundReplay } from './hideSeekGeneration';
import { LiveRound } from './hideSeekLiveRound';

/** Generations between automatic checkpoints. Pausing also saves one. */
const CHECKPOINT_EVERY = 5;

/**
 * Drives Hide and Seek co-evolution across the sim workers. A generation
 * is played round by round. Watch speeds play each round live on every
 * worker for the grid; Turbo and Max play it headless in batches. Results
 * of finished rounds are kept, so pausing between rounds loses nothing.
 */
export class HideSeekCoordinator {
  private readonly trainer: HideSeekTrainer;
  private speed: SpeedMode = '1x';
  private running = false;
  private pauseRequested = false;
  private stepsLeft = Infinity;
  private loopPromise: Promise<void> | null = null;
  private live: LiveRound | null = null;
  private done: MatchResult[][] = [];
  private epoch = 0;

  constructor(
    private readonly config: RunConfig,
    private readonly sims: Remote<SimApi>[],
    private readonly emit: HideSeekEventSink,
    state?: HideSeekTrainerState,
  ) {
    const { host, error } = safeHideSeekHost(hideSeekScriptSource(config, state?.history.length ?? 0));
    if (error) emit({ type: 'notice', message: `The script did not compile for Hide and Seek, so built-in rewards are used. ${error}` });
    this.trainer = state ? HideSeekTrainer.fromState(state) : HideSeekTrainer.create(hideSeekTrainerOptions(config, hideSeekSensorCounts(host)));
  }

  get generation(): number {
    return this.trainer.generation;
  }

  setSpeed(mode: SpeedMode): void {
    this.speed = mode;
    // A live round switched to Turbo or Max finishes flat out; the next round runs headless.
    this.live?.setSpeed(WATCH_SPEEDS[mode]);
  }

  /** Starts or resumes training. `generations` limits how many to run (used by Step). */
  start(generations = Infinity): void {
    this.stepsLeft = generations;
    this.pauseRequested = false;
    this.live?.setPaused(false);
    if (this.running) {
      this.emit({ type: 'status', status: 'running' });
      return;
    }
    this.running = true;
    this.emit({ type: 'status', status: 'running' });
    this.loopPromise = this.loop();
  }

  /** Freezes a live round at once; headless training stops after the current round. */
  pause(): void {
    this.pauseRequested = true;
    this.live?.setPaused(true);
    if (this.running) this.emit({ type: 'status', status: 'paused' });
  }

  async stop(): Promise<void> {
    this.pauseRequested = true;
    this.live?.stop();
    await this.loopPromise;
  }

  /** Taken mid generation, the state replans that generation identically on resume. */
  checkpoint(): HideSeekTrainerState {
    return this.trainer.toState();
  }

  private async loop(): Promise<void> {
    try {
      while (!this.pauseRequested && this.stepsLeft > 0) {
        if (!(await this.runGeneration())) break;
        this.stepsLeft--;
      }
    } catch (err) {
      this.emit({ type: 'error', message: err instanceof Error ? err.message : String(err) });
    } finally {
      this.running = false;
      this.live = null;
      this.emit({ type: 'status', status: this.pauseRequested || this.stepsLeft <= 0 ? 'paused' : 'idle' });
    }
  }

  /** Plays the rounds still missing from the current generation. Returns false when stopped part way. */
  private async runGeneration(): Promise<boolean> {
    const t = this.trainer;
    const started = performance.now();
    const plan = t.planGeneration();
    const generation = t.generation;
    const script = hideSeekScriptSource(this.config, generation);
    while (this.done.length < plan.length) {
      if (this.pauseRequested && this.done.length > 0 && !isWatchSpeed(this.speed)) return false;
      const r = this.done.length;
      const round = plan[r];
      const live = isWatchSpeed(this.speed);
      const epoch = ++this.epoch;
      this.emit({ type: 'round', generation, round: r, rounds: plan.length, layout: round[0].layout, matches: round.length, live, epoch });
      let results: MatchResult[] | null;
      if (live) {
        this.live = new LiveRound(this.sims, round, { generation, scriptSource: script, epoch }, WATCH_SPEEDS[this.speed], this.pauseRequested);
        results = await this.live.run();
        this.live = null;
      } else {
        results = await playHeadless(this.sims, round, script);
      }
      if (!results || results.length !== round.length) return false;
      this.done.push(results);
    }
    const replay = lastRoundReplay(plan, generation, script);
    const results = this.done;
    this.done = [];
    const stats = t.completeGeneration(results);
    this.emit({ type: 'generation', record: generationRecord(this.config.id, t, stats, replay, results, performance.now() - started) });
    if (t.generation % CHECKPOINT_EVERY === 0) this.emit({ type: 'checkpoint', generation: t.generation, state: t.toState() });
    return true;
  }
}
