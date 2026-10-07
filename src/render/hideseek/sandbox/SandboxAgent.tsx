'use client';

import { useCallback, useMemo } from 'react';
import { FLAG_AIRBORNE, FLAG_CLIMBING, FLAG_FROZEN, FLAG_HOLDING, FLAG_SEEING, FLAG_SEEN } from '@/engine/hideseek/snapshot';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import { useDisposable } from '@/render/shared/useDisposable';
import { HsCharacter } from '../characters/HsCharacter';
import { blockedAhead, findContact, lookAt, worthALook } from '../characters/perception';
import type { CharacterDrive } from '../characters/types';
import { useHsScene } from '../frame/sceneContext';
import type { SceneField } from '../frame/sceneField';
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
  /** Every player and box of the match, read once this frame. */
  field: SceneField;
}

/**
 * One Sandbox player: the same character as the training arenas, fed from
 * the Sandbox stream by slot, with a fading trail on the floor. A seeker
 * in prep sleeps like a frozen one, so it reads as switched off.
 */
export function SandboxAgent({ slot, team, tier, field }: Props) {
  const { frame } = useHsScene();
  const trail = useDisposable(() => new MotionTrail(teamColor(team)), [team]);
  const state = useMemo(() => ({ pose: { x: 0, z: 0, yaw: 0, elevation: 0 }, epoch: Number.NaN }), []);

  const read = useCallback(
    (d: CharacterDrive) => {
      const curr = sandboxFrame(frame);
      if (!curr) return false;
      const flags = readPlayer(frame, curr, slot, state.pose);
      const { x, z, yaw, elevation } = state.pose;
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
      d.elevation = elevation;
      d.climbing = hasFlag(flags, FLAG_CLIMBING);
      d.airborne = hasFlag(flags, FLAG_AIRBORNE);
      // Eyes on the nearest player of the other team when it sees or is seen, or comes close; hands on a box.
      const foe = field.nearest(team === 0 ? 1 : 0, x, z);
      const other = foe >= 0 ? field.agents[foe] : null;
      d.look = !!other && !other.frozen && worthALook(d, other.x, other.z, team === 0 ? d.seen : d.seeing);
      if (other && d.look) lookAt(d, other.x, other.z, other.elevation);
      findContact(d, field.boxes, field.boxCount);
      d.blocked = blockedAhead(d, field.walls);
      trail.update(x, z, elevation, !d.airborne, d.frozen ? 0 : 1);
    },
    [frame, slot, team, state, trail, field],
  );

  return (
    <group>
      <HsCharacter team={team === 0 ? 'hider' : 'seeker'} read={read} detail={tier === 'low' ? 'low' : 'full'} shadows={tier !== 'low'} blob={tier === 'low'} seed={slot} />
      <primitive object={trail.mesh} />
    </group>
  );
}
