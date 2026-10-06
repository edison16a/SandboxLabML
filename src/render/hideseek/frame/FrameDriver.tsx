'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useMemo } from 'react';
import { HIDESEEK_LAYOUT_IDS } from '@/engine/hideseek/layouts/presets';
import type { HideSeekLayoutId } from '@/engine/hideseek/layouts/types';
import { hideSeekSettingsOf } from '@/engine/training/hideseekRunConfig';
import { useHideSeekLab, type HideSeekLabState } from '@/features/hideseek/state/hideSeekStore';
import type { ArenaFeed } from '@/workers/client/arenaFeed';
import { latticeFor } from '../layout/gridLattice';
import { previewFeed } from './previewFeed';
import { useHsScene } from './sceneContext';
import { STRIDE } from './snapshotRead';

/** Room shown before anything has streamed: the round's, else the run's first. */
function idleLayout(s: HideSeekLabState): HideSeekLayoutId {
  if (s.mode === 'sandbox') return s.sandbox.layout;
  if (s.round) return s.round.layout;
  return s.run?.env === 'hideseek' ? hideSeekSettingsOf(s.run).layouts[0] : 'shelter';
}

/**
 * Runs first every frame. Picks the feed (live, replay or a still preview),
 * decides which arenas are drawn and where, and which one the showcase
 * takes over. Static instances (floors, walls) rebuild only when the
 * version it publishes changes.
 */
export function FrameDriver() {
  const { frame, getFeed } = useHsScene();
  const size = useThree((s) => s.size);
  const memo = useMemo(() => ({ previews: new Map<string, ArenaFeed>(), last: { count: -1, first: -1, cols: -1, focus: -2, epoch: Number.NaN, tagsRef: null as Int32Array | null } }), []);

  useFrame(() => {
    const s = useHideSeekLab.getState();
    const sandbox = s.mode === 'sandbox';
    const want = sandbox ? 1 : s.gridSize;
    let feed = getFeed();
    if (!feed?.curr || feed.count === 0) {
      const layout = idleLayout(s);
      const key = `${layout}:${want}`;
      feed = memo.previews.get(key) ?? previewFeed(layout, want);
      memo.previews.set(key, feed);
    }
    const total = feed.count;
    const single = want === 1;
    const first = single ? Math.min(Math.max(0, s.focus ?? 0), total - 1) : 0;
    const count = single ? 1 : Math.min(want, total);
    const focus = sandbox ? 0 : s.focus;
    const focusSlot = single ? 0 : focus !== null && focus < count ? focus : -1;
    const lattice = latticeFor(count, size.width / Math.max(1, size.height));

    const last = memo.last;
    if (last.count !== count || last.first !== first || last.cols !== lattice.cols || last.focus !== focusSlot || last.epoch !== feed.epoch || last.tagsRef !== feed.tags) {
      Object.assign(last, { count, first, cols: lattice.cols, focus: focusSlot, epoch: feed.epoch, tagsRef: feed.tags });
      const tags = feed.tags.length >= first + count ? feed.tags.subarray(first, first + count) : new Int32Array(count).fill(HIDESEEK_LAYOUT_IDS.indexOf(idleLayout(s)));
      frame.layouts = tags;
      frame.version++;
    }
    const curr = feed.curr as NonNullable<ArenaFeed['curr']>;
    frame.feed = feed;
    frame.curr = curr.buffer;
    frame.prev = feed.prev?.buffer ?? null;
    frame.alpha = feed.alpha();
    frame.count = count;
    frame.first = first;
    frame.lattice = lattice;
    frame.focusSlot = focusSlot;
    frame.dim = focusSlot >= 0 && count > 1 ? 0.8 : 1;
    frame.epoch = feed.epoch;
    frame.matchTime = curr.buffer[first * STRIDE] ?? 0;
    frame.prep = (curr.buffer[first * STRIDE + 1] ?? 1) === 1;
  }, -2);
  return null;
}
