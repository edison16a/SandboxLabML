import { NEVER_SEEN_AGE, SEEKER } from '../agents/agent';
import type { SightLines } from '../sensing/vision';
import type { SandboxState } from './state';

/**
 * Who sees whom when there are many players, after each step. It uses the
 * same sight lines as a 1 v 1 match (range, field of view, walls and boxes
 * block, agents do not) and checks every hider against every seeker.
 *
 * A brain was trained against one opponent, so each agent's opponent
 * inputs need one opponent to describe. We pick the nearest opponent it
 * can see, else the nearest one: a seen opponent is the one that matters
 * right now, and among the unseen the nearest is the likeliest threat or
 * catch. "Opponent in sight" is 1 when any opponent is in sight, and the
 * last sighting is the target's position at that moment.
 *
 * A hider counts as seen when any seeker sees it, and as exposed when any
 * seeker has a clear line to it. A seeker's seen, hidden and exposed
 * mirror its target hider's, so each pair agrees the way the two agents of
 * a 1 v 1 match do.
 */
export class SandboxVision {
  /** sees[viewer * n + target] is 1 when that viewer sees that target this tick. */
  private readonly sees: Uint8Array;

  constructor(private readonly n: number) {
    this.sees = new Uint8Array(n * n);
  }

  /** Before the first step: nothing is seen yet, and every target is simply the nearest opponent. */
  reset(s: SandboxState): void {
    this.sees.fill(0);
    this.pickTargets(s);
  }

  update(s: SandboxState, sight: SightLines): void {
    const n = this.n;
    const prep = s.tick <= s.prepTicks;
    const sees = this.sees;
    sees.fill(0);
    for (let i = 0; i < n; i++) {
      const viewer = s.agents[i];
      if (viewer.index === SEEKER && prep) continue;
      for (let j = 0; j < n; j++) {
        const target = s.agents[j];
        if (target.index !== viewer.index && sight.sees(viewer, target)) sees[i * n + j] = 1;
      }
    }

    let anySeen = false;
    let anyExposed = false;
    for (let h = 0; h < s.hiders; h++) {
      const hider = s.agents[h];
      let seen = false;
      let exposed = false;
      for (let k = s.hiders; k < n; k++) {
        if (sees[k * n + h]) seen = exposed = true;
        else if (!exposed && sight.inLine(s.agents[k], hider)) exposed = true;
        if (seen) break;
      }
      hider.seen = seen;
      hider.hidden = !prep && !seen;
      hider.exposed = exposed;
      anySeen ||= seen;
      anyExposed ||= exposed;
    }
    for (let k = s.hiders; k < n; k++) {
      let seen = 0;
      for (let h = 0; h < s.hiders && !seen; h++) seen = sees[h * n + k];
      s.seenByOpponent[k] = seen;
    }

    this.pickTargets(s);
    for (let i = 0; i < n; i++) {
      const a = s.agents[i];
      const t = s.targets[i];
      if (a.index === SEEKER) {
        const hider = t >= 0 ? s.agents[t] : null;
        a.seen = hider?.seen ?? false;
        a.hidden = !prep && !a.seen;
        a.exposed = hider?.exposed ?? false;
      }
      if (a.seesOpponent) {
        a.lastSeenAge = 0;
        a.lastSeenX = s.agents[t].x;
        a.lastSeenZ = s.agents[t].z;
      } else if (a.lastSeenAge < NEVER_SEEN_AGE) {
        a.lastSeenAge += s.physics.dt;
      }
    }

    if (prep) return;
    const tally = s.tally;
    tally.seekTicks++;
    if (anyExposed) tally.exposedTicks++;
    if (!anySeen) tally.hiddenTicks++;
    else {
      tally.seenTicks++;
      if (tally.firstSeenTick < 0) tally.firstSeenTick = s.tick;
    }
  }

  /** Each agent's target: the nearest opponent it sees, else the nearest. Ties go to the lower slot. */
  private pickTargets(s: SandboxState): void {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      const a = s.agents[i];
      let seenBest = -1;
      let seenD = Infinity;
      let anyBest = -1;
      let anyD = Infinity;
      for (let j = 0; j < n; j++) {
        const b = s.agents[j];
        if (b.index === a.index) continue;
        const d = Math.hypot(b.x - a.x, b.z - a.z);
        if (d < anyD) {
          anyD = d;
          anyBest = j;
        }
        if (this.sees[i * n + j] && d < seenD) {
          seenD = d;
          seenBest = j;
        }
      }
      a.seesOpponent = seenBest >= 0;
      s.targets[i] = seenBest >= 0 ? seenBest : anyBest;
    }
  }
}
