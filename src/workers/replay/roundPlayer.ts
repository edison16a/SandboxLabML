import type { HideSeekMatch } from '@/engine/hideseek/match/match';
import { startMatch } from '@/engine/hideseek/match/runMatch';
import type { ArenaPool } from '@/engine/hideseek/world/pool';
import { replaySpecs, type RoundReplay } from '@/engine/training/hideseekRecords';
import type { ArenaFrameWriter } from '../shared/arenaFrames';
import type { HideSeekHostCache } from '../shared/hideSeekHost';
import { Pacer } from '../shared/pacer';

/** Pause between loops of a replayed round, so the end of a match can be read before it restarts. */
const LOOP_GAP_MS = 1500;

/**
 * Replays a stored round for the grid while training runs headless in
 * Turbo. The matches are re-simulated from their genomes and seeds with the
 * same `step` as training, so the replay is the round that was scored.
 */
export class RoundPlayer {
  private pacer: Pacer | null = null;
  private matches: HideSeekMatch[] = [];
  private run = 0;

  constructor(
    private readonly frames: ArenaFrameWriter,
    private readonly arenas: () => Promise<ArenaPool>,
    private readonly hosts: HideSeekHostCache,
  ) {}

  async play(replay: RoundReplay, speed: number, loop: boolean): Promise<void> {
    const runId = ++this.run;
    this.stopPlayback();
    const pool = await this.arenas();
    if (runId !== this.run) return;
    const specs = replaySpecs(replay);
    this.matches = specs.map((s) => startMatch(s, pool, this.hosts.controllers(replay.scriptSource, s.seed)));
    const matches = this.matches;
    let tick = 0;
    this.frames.begin(matches, { first: 0, total: matches.length, epoch: runId }, replay.generation);
    this.frames.send(matches, 0);
    const pacer = new Pacer(
      speed,
      30,
      (n) => {
        let alive = false;
        for (const m of matches) {
          for (let k = 0; k < n && !m.done; k++) m.step();
          alive ||= !m.done;
        }
        tick += n;
        return alive;
      },
      () => this.frames.send(matches, tick),
      () => {
        this.frames.send(matches, tick);
        if (loop && runId === this.run) setTimeout(() => runId === this.run && void this.play(replay, speed, loop), LOOP_GAP_MS);
      },
    );
    this.pacer = pacer;
    pacer.start();
  }

  setSpeed(speed: number): void {
    this.pacer?.setSpeed(speed);
  }

  setPaused(paused: boolean): void {
    this.pacer?.setPaused(paused);
  }

  /** Stops playback and any pending loop, and frees the worlds. */
  stop(): void {
    this.run++;
    this.stopPlayback();
  }

  private stopPlayback(): void {
    this.pacer?.stop();
    this.pacer = null;
    for (const m of this.matches) m.release();
    this.matches = [];
  }
}
