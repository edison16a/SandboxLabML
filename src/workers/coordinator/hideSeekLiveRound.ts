import type { Remote } from 'comlink';
import type { MatchResult, MatchSpec } from '@/engine/hideseek/match/types';
import type { SimApi } from '../sim/sim.worker';
import { splitLiveRound } from './hideSeekFarm';
import { TickPacer } from './tickPacer';

export interface LiveRoundInfo {
  generation: number;
  scriptSource: string | null;
  /** Identifies this round in the merged stream, so stale frames from the last one are dropped. */
  epoch: number;
}

/**
 * One round played live for the grid. Every sim worker opens its slice of
 * the matches, then the pacer steps all of them together: a slice only
 * starts once every worker finished the last one, so all arenas stay on the
 * same tick and the merged stream never mixes ticks.
 */
export class LiveRound {
  private pacer: TickPacer | null = null;
  private cancel: (() => void) | null = null;
  private stopped = false;
  private speed: number;
  private paused: boolean;

  constructor(
    private readonly sims: Remote<SimApi>[],
    private readonly specs: MatchSpec[],
    private readonly info: LiveRoundInfo,
    speed: number,
    paused: boolean,
  ) {
    this.speed = speed;
    this.paused = paused;
  }

  /** Plays the round. Resolves with results in spec order, or null when stopped part way. */
  async run(): Promise<MatchResult[] | null> {
    const splits = splitLiveRound(this.specs, this.sims.length, this.info.epoch);
    const active = splits.map((s) => this.sims[s.sim]);
    await Promise.all(
      splits.map((s) => this.sims[s.sim].loadHideSeekLive({ part: s.part, specs: s.specs, scriptSource: this.info.scriptSource, generation: this.info.generation })),
    );
    if (this.stopped) return this.abort(active);
    const finished = await new Promise<boolean>((resolve, reject) => {
      this.cancel = () => resolve(false);
      const step = async (n: number) => !(await Promise.all(active.map((sim) => sim.stepHideSeekLive(n)))).every(Boolean);
      this.pacer = new TickPacer(this.speed, 30, step, () => resolve(true), reject);
      this.pacer.setPaused(this.paused);
      this.pacer.start();
    });
    if (!finished) return this.abort(active);
    const parts = await Promise.all(active.map((sim) => sim.finishHideSeekLive()));
    return parts.flat();
  }

  setSpeed(speed: number): void {
    this.speed = speed;
    this.pacer?.setSpeed(speed);
  }

  setPaused(paused: boolean): void {
    this.paused = paused;
    this.pacer?.setPaused(paused);
  }

  stop(): void {
    this.stopped = true;
    this.pacer?.stop();
    this.cancel?.();
  }

  private async abort(active: Remote<SimApi>[]): Promise<null> {
    await Promise.all(active.map((sim) => sim.stopHideSeekLive()));
    return null;
  }
}
