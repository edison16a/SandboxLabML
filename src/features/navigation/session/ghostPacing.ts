import { NAV_RUNNING } from '@/engine/navigation/agent';
import { NAVIGATION_SNAPSHOT, SNAP_STATUS } from '@/engine/navigation/snapshot';
import type { StreamOut } from '@/workers/shared/protocol';

/** The longest a replay holds the next champion back, ms: a runner left standing until its time runs out should not keep the view for half a minute. */
const MAX_HOLD = 14_000;

/** True when no agent of a snapshot frame is still running. */
export function allStopped(buffer: Float32Array, count: number): boolean {
  for (let i = 0; i < count; i++) if (buffer[i * NAVIGATION_SNAPSHOT.stride + SNAP_STATUS] === NAV_RUNNING) return false;
  return true;
}

/**
 * Paces the ghost replay while Turbo trains. A Navigation generation is
 * over in a fraction of a second and brings a new course and a new
 * champion each time, so restarting the replay on every one would never
 * let a run play out. Instead a replay runs to its end (or MAX_HOLD), and
 * only then does the newest champion take over, on the newest course.
 */
export class GhostPacing {
  private busy = false;
  private since = 0;
  private pending = false;

  constructor(private readonly release: () => void) {}

  /** Feeds it the ghost stream's messages. */
  readonly listen = (msg: StreamOut): void => {
    if (msg.kind === 'start') {
      this.busy = true;
      this.since = performance.now();
    } else if (msg.kind === 'frame' && this.busy && allStopped(msg.buffer, msg.count)) {
      this.busy = false;
      if (this.pending) {
        this.pending = false;
        this.release();
      }
    }
  };

  /** True when a refresh should wait for the replay on screen to end; it then comes by itself. */
  hold(): boolean {
    if (!this.busy || performance.now() - this.since > MAX_HOLD) return false;
    this.pending = true;
    return true;
  }

  /** Forgets a waiting refresh, as when a run opens or training stops. */
  reset(): void {
    this.pending = false;
    this.busy = false;
  }
}
