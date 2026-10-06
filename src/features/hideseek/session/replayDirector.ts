import type { RoundReplay } from '@/engine/training/hideseekRecords';
import type { HideSeekPool } from '@/workers/client/hideSeekPool';
import { useHideSeekLab } from '../state/hideSeekStore';
import type { RoundInfo } from '../state/types';

/** Gap between loops, so the end of a round can be read before the next starts. */
const LOOP_GAP_MS = 1500;

/**
 * Decides what the viewport shows while training. A live round streams
 * every arena; in Turbo, rounds run headless, so the grid loops a replay of
 * the newest round instead. A newer round waits until the current loop
 * ends, so a replay is never cut off half way. Max stops the replay to give
 * training every core.
 */
export class ReplayDirector {
  private latest: RoundReplay | null = null;
  private playing = false;
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly pool: HideSeekPool) {
    pool.replayed.on((msg) => {
      if (msg.kind !== 'end' || !this.playing) return;
      this.playing = false;
      this.timer = setTimeout(() => {
        this.timer = null;
        this.update();
      }, LOOP_GAP_MS);
    });
  }

  private get store() {
    return useHideSeekLab.getState();
  }

  /** Forgets the run's replay, e.g. when another run opens. */
  reset(latest: RoundReplay | null): void {
    this.latest = latest;
    this.stop();
  }

  /** A generation finished; its last round becomes the next loop. */
  offer(replay: RoundReplay | undefined): void {
    if (replay) this.latest = replay;
    this.update();
  }

  /** A round is starting. Live rounds take over the viewport straight away. */
  onRound(info: RoundInfo): void {
    if (info.live && this.store.mode === 'train') {
      this.stop();
      this.store.set({ source: 'live' });
    }
    this.update();
  }

  /** Starts a replay when Turbo needs one and none is playing; stops it when nothing does. */
  update(): void {
    const s = this.store;
    const wanted = s.mode === 'train' && s.speed === 'turbo' && !s.replayBlocked && this.latest !== null && !s.round?.live;
    if (!wanted) {
      if (s.mode === 'train' && s.speed !== 'turbo') this.stop();
      return;
    }
    if (this.playing || this.timer) return;
    const replay = this.latest as RoundReplay;
    this.playing = true;
    s.set({ source: 'replay', replaying: true, replayOf: { generation: replay.generation, round: replay.round, rounds: replay.rounds } });
    void this.pool.replay.playRound(replay, 1, false);
  }

  stop(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (this.playing) void this.pool.replay.stopRound();
    this.playing = false;
    if (this.store.replaying) this.store.set({ replaying: false });
  }
}
