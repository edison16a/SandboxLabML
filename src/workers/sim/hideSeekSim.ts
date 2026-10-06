import type { HideSeekMatch } from '@/engine/hideseek/match/match';
import { runMatch, startMatch } from '@/engine/hideseek/match/runMatch';
import type { MatchResult, MatchSpec } from '@/engine/hideseek/match/types';
import { createArenaPool, type ArenaPool } from '@/engine/hideseek/world/pool';
import type { ArenaFrameWriter } from '../shared/arenaFrames';
import { HideSeekHostCache } from '../shared/hideSeekHost';
import type { StreamPart } from '../shared/protocol';

/** This worker's slice of a live round: a run of consecutive matches. */
export interface LiveRoundPart {
  part: StreamPart;
  specs: MatchSpec[];
  scriptSource: string | null;
  generation: number;
}

/**
 * Hide and Seek inside a sim worker. Headless batches play whole matches
 * as fast as possible. A live round keeps its matches open and steps them
 * only when the coordinator says so, which is the shared tick barrier that
 * keeps every arena of the grid on the same tick.
 */
export class HideSeekSim {
  private pool: Promise<ArenaPool> | null = null;
  private readonly hosts = new HideSeekHostCache();
  private live: HideSeekMatch[] = [];
  private tick = 0;

  constructor(private readonly frames: ArenaFrameWriter | null) {}

  /** One Rapier load and one pool per worker for its whole life. */
  private arenas(): Promise<ArenaPool> {
    this.pool ??= createArenaPool();
    return this.pool;
  }

  async evaluate(specs: MatchSpec[], scriptSource: string | null): Promise<MatchResult[]> {
    const pool = await this.arenas();
    return specs.map((s) => runMatch(s, pool, this.hosts.controllers(scriptSource, s.seed)));
  }

  /** Opens this worker's matches of a live round and streams their first frame. */
  async loadLive(req: LiveRoundPart): Promise<void> {
    this.stopLive();
    const pool = await this.arenas();
    this.live = req.specs.map((s) => startMatch(s, pool, this.hosts.controllers(req.scriptSource, s.seed)));
    this.tick = 0;
    this.frames?.begin(this.live, req.part, req.generation);
    this.frames?.send(this.live, 0);
  }

  /** Steps every open match `n` ticks, streams one frame and reports whether all of them are over. */
  stepLive(n: number): boolean {
    let done = true;
    for (const m of this.live) {
      for (let k = 0; k < n && !m.done; k++) m.step();
      done &&= m.done;
    }
    this.tick += n;
    if (this.live.length) this.frames?.send(this.live, this.tick);
    return done;
  }

  /** Results of the live matches in order, then hands their worlds back to the pool. */
  finishLive(): MatchResult[] {
    const results = this.live.map((m) => m.result());
    this.frames?.end();
    this.stopLive();
    return results;
  }

  stopLive(): void {
    for (const m of this.live) m.release();
    this.live = [];
  }
}
