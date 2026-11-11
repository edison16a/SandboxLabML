'use client';

import { useCallback, useMemo } from 'react';
import { FLAG_TOUCHING, NAV_DIED, NAV_FINISHED } from '@/engine/navigation/agent';
import { SNAP_FLAGS, SNAP_STATUS, SNAP_STOP_TIME } from '@/engine/navigation/snapshot';
import type { CharacterDrive } from '@/render/hideseek/characters/types';
import { useNavScene } from '../frame/sceneContext';
import { STRIDE } from '../frame/snapshotRead';
import type { NavQualityTier } from '../types';
import { NavCharacter } from './NavCharacter';
import { stopPose, type StopPose } from './stopPose';

/** Movers nearer than this catch the champion's eye, m. */
const LOOK_RANGE = 3.2;

/**
 * The followed agent drawn in full (the crowd leaves a gap for it). Its
 * eyes go to a mover close by, it looks startled as it falls and keen as
 * it crosses the line, and it starts fresh whenever the view moves to
 * another agent.
 */
export function ChampionAgent({ tier }: { tier: NavQualityTier }) {
  const { frame } = useNavScene();
  const state = useMemo(() => ({ version: -1 }), []);

  const read = useCallback(
    (d: CharacterDrive, stop: StopPose) => {
      const curr = frame.curr;
      const i = frame.leader;
      if (!curr || i < 0 || i >= frame.count) return false;
      const o = i * STRIDE;
      const status = curr[o + SNAP_STATUS];
      const flags = curr[o + SNAP_FLAGS];
      stopPose(status, flags, frame.time - curr[o + SNAP_STOP_TIME], stop);
      if (stop.alpha <= 0.01) return false;
      const p = frame.leaderPose;
      if (state.version !== frame.leaderVersion) {
        state.version = frame.leaderVersion;
        d.teleported = true;
      }
      d.x = p.x;
      d.z = p.z;
      d.yaw = p.yaw;
      d.seen = status === NAV_DIED;
      d.seeing = status === NAV_FINISHED;
      d.blocked = (flags & FLAG_TOUCHING) !== 0;
      d.look = false;
      const course = frame.course;
      if (course) {
        let best = LOOK_RANGE;
        for (let k = 0; k < course.movers.length; k++) {
          const mx = frame.movers[k * 2];
          const mz = frame.movers[k * 2 + 1];
          const dist = Math.hypot(mx - p.x, mz - p.z);
          if (dist >= best) continue;
          best = dist;
          d.look = true;
          d.lookX = mx;
          d.lookY = 0.6;
          d.lookZ = mz;
        }
      }
    },
    [frame, state],
  );

  return <NavCharacter read={read} detail={tier === 'low' ? 'low' : 'full'} shadows={tier !== 'low'} blob={tier === 'low'} />;
}
