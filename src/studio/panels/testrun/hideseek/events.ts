import { TEAMS } from '@/engine/hideseek/agents/agent';
import type { MatchState } from '@/engine/hideseek/match/state';
import { BOX_KINDS } from '@/engine/hideseek/physics';

/**
 * Turns a match into a list of plain events, one tick at a time. A match
 * only keeps flags for the latest tick (justGrabbed and friends) and the
 * current sight state, so this remembers the previous tick to see what
 * changed: prep ending, the hider being spotted or getting away, boxes
 * grabbed, locked or unlocked (by the team that owns the lock), players
 * running up a ramp or vaulting a wall, and a script stopping a player.
 */
export class MatchEvents {
  private prep: boolean;
  private seen: boolean;
  private hidden: boolean;
  /** Team that owns each box's lock, -1 while free. */
  private readonly owner: number[];
  private readonly climbing: boolean[];
  private readonly stopped: boolean[];

  constructor(s: MatchState) {
    const hider = s.agents[0];
    this.prep = hider.prep;
    this.seen = hider.seen;
    this.hidden = hider.hidden;
    this.owner = s.boxes.map((b) => b.lockedBy);
    this.climbing = s.agents.map((a) => a.climbing);
    this.stopped = s.agents.map((a) => a.stopReason !== null);
  }

  /** What happened on the tick that just ran, in the order a reader would tell it. */
  next(s: MatchState): string[] {
    const out: string[] = [];
    const hider = s.agents[0];
    if (this.prep && !hider.prep) out.push('prep over');
    if (hider.seen && !this.seen) out.push('hider seen');
    if (hider.hidden && !this.hidden) out.push('hider hidden');
    s.agents.forEach((a, i) => {
      if (a.justGrabbed) out.push(`${a.team} grabbed a ${BOX_KINDS[a.heldBox] ?? 'box'}`);
      if (a.justReleased) out.push(`${a.team} let go`);
      if (a.climbing && !this.climbing[i]) out.push(`${a.team} ran up a ramp`);
      if (a.justVaulted) out.push(`${a.team} vaulted a wall`);
      this.climbing[i] = a.climbing;
    });
    s.boxes.forEach((b, i) => {
      const was = this.owner[i];
      if (b.lockedBy !== was) out.push(b.lockedBy >= 0 ? `${TEAMS[b.lockedBy]} locked a ${BOX_KINDS[i]}` : `${TEAMS[was]} unlocked a ${BOX_KINDS[i]}`);
      this.owner[i] = b.lockedBy;
    });
    s.agents.forEach((a, i) => {
      const stopped = a.stopReason !== null;
      if (stopped && !this.stopped[i]) out.push(`${a.team} stopped: ${a.stopReason}`);
      this.stopped[i] = stopped;
    });
    this.prep = hider.prep;
    this.seen = hider.seen;
    this.hidden = hider.hidden;
    return out;
  }
}
