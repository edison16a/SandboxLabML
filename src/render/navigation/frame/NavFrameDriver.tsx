'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import type { NavFeed } from '../types';
import { LeaderPicker } from './leader';
import type { NavFrame } from './navFrame';
import { DRIVER_PRIORITY, useNavScene } from './sceneContext';
import { blendAgent, blendMovers, blendTime } from './snapshotRead';

/** Added to a ghost feed's epoch, so moving between the population and the ghosts reads as a new episode and the camera glides over. */
const GHOST_EPOCH = 1 << 20;

const ready = (f: NavFeed | null | undefined): f is NavFeed => !!f && f.course !== null && f.curr !== null;

/**
 * Runs first every frame: reads the feed into the shared frame, blends the
 * clock and the movers, and picks the agent the view follows (the one the
 * feed pins, else the best runner). The population is the followed feed
 * whenever it streams; without it the ghost replay takes its place, and a
 * replay on the same course also rides along as ghosts. Everything else
 * in the scene reads the frame, never the feeds.
 */
export function NavFrameDriver({ onFollow }: { onFollow?: (ghost: boolean, index: number) => void }) {
  const { frame, getFeed, getGhosts } = useNavScene();
  const picker = useMemo(() => new LeaderPicker(), []);
  const told = useMemo(() => ({ ghost: false, index: -2 }), []);

  useFrame(() => {
    const pop = getFeed();
    const ghosts = getGhosts?.() ?? null;
    const usePop = ready(pop) || !ready(ghosts);
    const feed = usePop ? pop : ghosts;
    frame.feed = feed;
    frame.primaryGhosts = !usePop;
    if (!feed || !feed.course) {
      frame.course = null;
      frame.curr = frame.prev = null;
      frame.count = 0;
      frame.leader = -1;
      frame.ghosts.feed = null;
      return report(frame, told, onFollow);
    }
    if (feed.course !== frame.course) {
      frame.course = feed.course;
      frame.courseVersion++;
    }
    frame.curr = feed.curr;
    frame.prev = feed.prev;
    frame.alpha = feed.alpha();
    frame.count = feed.count;
    frame.timeScale = feed.timeScale;
    const epoch = feed.epoch + (usePop ? 0 : GHOST_EPOCH);
    const time = blendTime(feed.prevWorld, feed.world, frame.alpha);
    frame.simDt = epoch === frame.epoch ? Math.min(0.25, Math.max(0, time - frame.time)) : 0;
    frame.time = time;
    frame.epoch = epoch;
    blendMovers(feed.prevWorld, feed.world, frame.alpha, frame.movers);
    const before = frame.leader;
    const pinned = feed.follow;
    frame.leader = pinned !== null && pinned !== undefined && pinned >= 0 && pinned < frame.count ? pinned : picker.pick(frame.curr, frame.count, frame.time, frame.epoch);
    if (frame.leader !== before) frame.leaderVersion++;
    if (frame.leader >= 0 && frame.curr) blendAgent(frame.prev, frame.curr, frame.leader, frame.alpha, frame.leaderPose);
    layGhosts(frame, usePop ? ghosts : feed, usePop ? -1 : frame.leader);
    report(frame, told, onFollow);
  }, DRIVER_PRIORITY);
  return null;
}

/** Fills the ghost layer from a ghost feed on the frame's own course, or empties it. */
function layGhosts(frame: NavFrame, feed: NavFeed | null, skip: number): void {
  const g = frame.ghosts;
  if (!ready(feed) || feed.course !== frame.course) {
    g.feed = null;
    g.curr = g.prev = null;
    g.count = 0;
    return;
  }
  g.feed = feed;
  g.curr = feed.curr;
  g.prev = feed.prev;
  g.alpha = feed.alpha();
  g.count = feed.count;
  g.time = blendTime(feed.prevWorld, feed.world, g.alpha);
  g.skip = skip;
}

/** Tells the viewport's owner which agent the view follows, only when it changes. */
function report(frame: NavFrame, told: { ghost: boolean; index: number }, onFollow?: (ghost: boolean, index: number) => void): void {
  if (!onFollow || (told.ghost === frame.primaryGhosts && told.index === frame.leader)) return;
  told.ghost = frame.primaryGhosts;
  told.index = frame.leader;
  onFollow(frame.primaryGhosts, frame.leader);
}
