'use client';

import { useCallback, useMemo } from 'react';
import { FLAG_FROZEN, FLAG_HOLDING, FLAG_SEEING, FLAG_SEEN } from '@/engine/hideseek/snapshot';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import { useDisposable } from '@/render/shared/useDisposable';
import { HsCharacter } from '../characters/HsCharacter';
import type { CharacterDrive } from '../characters/types';
import { useHsScene } from '../frame/sceneContext';
import { hasFlag } from '../frame/snapshotRead';
import { teamColor } from '../palette';
import { MotionTrail } from '../showcase/MotionTrail';
import { readPlayer, sandboxFrame, seekerIdle } from './sandboxRead';

/** A jump this long between two frames is a teleport (a new match, a respawn), m. */
const TELEPORT = 1.5;

interface Props {
  /** Slot in the Sandbox frame. */
  slot: number;
  /** 0 hider, 1 seeker. */
  team: 0 | 1;
  tier: HsQualityTier;
}

/**
 * One Sandbox player: the same character as the training arenas, fed from
 * the Sandbox stream by slot, with a fading trail on the floor. A seeker
 * in prep sleeps like a frozen one, so it reads as switched off.
 */
export function SandboxAgent({ slot, team, tier }: Props) {
  const { frame } = useHsScene();
  const trail = useDisposable(() => new MotionTrail(teamColor(team)), [team]);
  const state = useMemo(() => ({ pose: { x: 0, z: 0, yaw: 0 }, epoch: Number.NaN }), []);

  const read = useCallback(
    (d: CharacterDrive) => {
      const curr = sandboxFrame(frame);
      if (!curr) return false;
      const flags = readPlayer(frame, curr, slot, state.pose);
      const { x, z, yaw } = state.pose;
      if (state.epoch !== frame.epoch || Math.hypot(x - d.x, z - d.z) > TELEPORT) {
        state.epoch = frame.epoch;
        d.teleported = true;
        trail.reset();
      }
      d.x = x;
      d.z = z;
      d.yaw = yaw;
      d.frozen = team === 1 ? seekerIdle(curr, flags) : hasFlag(flags, FLAG_FROZEN);
      d.seen = team === 0 && hasFlag(flags, FLAG_SEEN);
      d.seeing = team === 1 && hasFlag(flags, FLAG_SEEING);
      d.holding = hasFlag(flags, FLAG_HOLDING);
      trail.update(x, z, d.frozen ? 0 : 1);
    },
    [frame, slot, team, state, trail],
  );

  return (
    <group>
      <HsCharacter team={team === 0 ? 'hider' : 'seeker'} read={read} detail={tier === 'low' ? 'low' : 'full'} shadows={tier !== 'low'} blob={tier === 'low'} seed={slot} />
      <primitive object={trail.mesh} />
    </group>
  );
}
