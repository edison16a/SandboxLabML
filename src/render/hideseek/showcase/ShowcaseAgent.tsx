'use client';

import { useCallback, useMemo } from 'react';
import { FLAG_FROZEN, FLAG_HOLDING, FLAG_SEEING, FLAG_SEEN } from '@/engine/hideseek/snapshot';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import { useDisposable } from '@/render/shared/useDisposable';
import { HsCharacter } from '../characters/HsCharacter';
import type { CharacterDrive } from '../characters/types';
import { useHsScene } from '../frame/sceneContext';
import { agentAt, blendFloorPose, hasFlag } from '../frame/snapshotRead';
import { teamColor } from '../palette';
import { MotionTrail } from './MotionTrail';

/** A jump this long between two frames is a teleport (a new match, a Sandbox drag), m. */
const TELEPORT = 1.5;

/**
 * One agent of the showcase arena: the full character, fed from the arena
 * stream, and a fading trail on the floor behind it. The cheapest tier
 * gets the plain material and a blob shadow; the others cast real shadows.
 */
export function ShowcaseAgent({ arena, agent, tier }: { arena: number; agent: 0 | 1; tier: HsQualityTier }) {
  const { frame } = useHsScene();
  const trail = useDisposable(() => new MotionTrail(teamColor(agent)), [agent]);
  const state = useMemo(() => ({ pose: { x: 0, z: 0, yaw: 0 }, epoch: Number.NaN }), []);

  const read = useCallback(
    (d: CharacterDrive) => {
      const curr = frame.curr;
      if (!curr) return false;
      const o = agentAt(arena, agent);
      blendFloorPose(frame.prev, curr, o, frame.alpha, state.pose);
      const { x, z, yaw } = state.pose;
      if (state.epoch !== frame.epoch || Math.hypot(x - d.x, z - d.z) > TELEPORT) {
        state.epoch = frame.epoch;
        d.teleported = true;
        trail.reset();
      }
      const flags = curr[o + 3];
      d.x = x;
      d.z = z;
      d.yaw = yaw;
      d.frozen = hasFlag(flags, FLAG_FROZEN);
      d.seen = agent === 0 && hasFlag(flags, FLAG_SEEN);
      d.seeing = agent === 1 && hasFlag(flags, FLAG_SEEING);
      d.holding = hasFlag(flags, FLAG_HOLDING);
      trail.update(x, z, d.frozen ? 0 : 1);
    },
    [frame, arena, agent, state, trail],
  );

  return (
    <group>
      <HsCharacter team={agent === 0 ? 'hider' : 'seeker'} read={read} detail={tier === 'low' ? 'low' : 'full'} shadows={tier !== 'low'} blob={tier === 'low'} seed={agent} />
      <primitive object={trail.mesh} />
    </group>
  );
}
