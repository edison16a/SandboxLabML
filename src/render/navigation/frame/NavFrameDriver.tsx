'use client';

import { useFrame } from '@react-three/fiber';
import { useMemo } from 'react';
import { LeaderPicker } from './leader';
import { DRIVER_PRIORITY, useNavScene } from './sceneContext';
import { blendAgent, blendMovers, blendTime } from './snapshotRead';

/**
 * Runs first every frame: reads the feed into the shared frame, blends the
 * clock and the movers, and picks the agent the view follows (the one the
 * feed pins, else the best runner). Everything else in the scene reads the
 * frame, never the feed.
 */
export function NavFrameDriver() {
  const { frame, getFeed } = useNavScene();
  const picker = useMemo(() => new LeaderPicker(), []);

  useFrame(() => {
    const feed = getFeed();
    frame.feed = feed;
    if (!feed || !feed.course) {
      frame.course = null;
      frame.curr = frame.prev = null;
      frame.count = 0;
      frame.leader = -1;
      return;
    }
    if (feed.course !== frame.course) {
      frame.course = feed.course;
      frame.courseVersion++;
    }
    frame.curr = feed.curr;
    frame.prev = feed.prev;
    frame.alpha = feed.alpha();
    frame.count = feed.count;
    frame.epoch = feed.epoch;
    frame.timeScale = feed.timeScale;
    frame.time = blendTime(feed.prevWorld, feed.world, frame.alpha);
    blendMovers(feed.prevWorld, feed.world, frame.alpha, frame.movers);
    const before = frame.leader;
    const pinned = feed.follow;
    frame.leader = pinned !== null && pinned !== undefined && pinned >= 0 && pinned < frame.count ? pinned : picker.pick(frame.curr, frame.count, frame.time, frame.epoch);
    if (frame.leader !== before) frame.leaderVersion++;
    if (frame.leader >= 0 && frame.curr) blendAgent(frame.prev, frame.curr, frame.leader, frame.alpha, frame.leaderPose);
  }, DRIVER_PRIORITY);
  return null;
}
