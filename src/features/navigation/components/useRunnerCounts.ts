'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { NAV_DIED, NAV_FINISHED, NAV_RUNNING } from '@/engine/navigation/agent';
import { NAVIGATION_SNAPSHOT, SNAP_PROGRESS, SNAP_STATUS } from '@/engine/navigation/snapshot';
import { useNavigationLab } from '../state/labStore';
import type { LabFeeds } from '../viewport/labFeeds';

const STRIDE = NAVIGATION_SNAPSHOT.stride;
const TICK_MS = 250;

/** How the runners on screen are doing. `watching` is false when no runner is on screen to count. */
export interface RunnerCounts {
  watching: boolean;
  level: number;
  running: number;
  finished: number;
  died: number;
  total: number;
  best: number;
}

const NONE: RunnerCounts = { watching: false, level: 0, running: 0, finished: 0, died: 0, total: 0, best: 0 };

/** Counts the runners the feeds show now: the live population in training, the Sandbox's own runners there. */
function countRunners(feeds: LabFeeds): RunnerCounts {
  const s = useNavigationLab.getState();
  const level = feeds.level(s);
  const frame = feeds.counted(s);
  if (!frame) return { ...NONE, level };
  const { buffer, count } = frame;
  const out: RunnerCounts = { watching: true, level, running: 0, finished: 0, died: 0, total: count, best: 0 };
  for (let i = 0; i < count; i++) {
    const status = buffer[i * STRIDE + SNAP_STATUS];
    if (status === NAV_RUNNING) out.running++;
    else if (status === NAV_FINISHED) out.finished++;
    else if (status === NAV_DIED) out.died++;
    out.best = Math.max(out.best, status === NAV_FINISHED ? 1 : buffer[i * STRIDE + SNAP_PROGRESS]);
  }
  return out;
}

const same = (a: RunnerCounts, b: RunnerCounts) =>
  a.watching === b.watching && a.level === b.level && a.running === b.running && a.finished === b.finished && a.died === b.died && a.total === b.total && a.best === b.best;

/**
 * One count four times a second per set of feeds, shared by every reader.
 * The HUD and the Sandbox footer both read it, so they can never disagree,
 * and nothing redraws per frame.
 */
class CountsStore {
  private counts = NONE;
  private timer: ReturnType<typeof setInterval> | null = null;
  private readonly listeners = new Set<() => void>();

  constructor(private readonly feeds: LabFeeds) {}

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    if (!this.timer) {
      this.tick();
      this.timer = setInterval(() => this.tick(), TICK_MS);
    }
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0 && this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
    };
  };

  readonly get = (): RunnerCounts => this.counts;

  private tick(): void {
    const next = countRunners(this.feeds);
    if (same(next, this.counts)) return;
    this.counts = next;
    for (const listener of this.listeners) listener();
  }
}

const stores = new WeakMap<LabFeeds, CountsStore>();

/** The shared runner counts for these feeds. Gives no runners while the feeds are not ready. */
export function useRunnerCounts(feeds: LabFeeds | null): RunnerCounts {
  const store = feeds ? (stores.get(feeds) ?? stores.set(feeds, new CountsStore(feeds)).get(feeds)!) : null;
  const subscribe = useCallback((listener: () => void) => store?.subscribe(listener) ?? (() => {}), [store]);
  return useSyncExternalStore(subscribe, () => store?.get() ?? NONE, () => NONE);
}
