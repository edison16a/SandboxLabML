'use client';

import { useMemo } from 'react';
import { boxKindSize, DEFAULT_HIDESEEK_PHYSICS, type BoxKind } from '@/engine/hideseek/physics';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import { HsBox, type BoxDrive } from '../boxes/HsBox';
import { useHsScene } from '../frame/sceneContext';
import type { BoxPointerHandler } from '../showcase/ShowcaseBoxes';
import { isLocked, readBox, sandboxFrame } from './sandboxRead';

const SIZES: Record<BoxKind, ReturnType<typeof boxKindSize>> = {
  cube: boxKindSize(DEFAULT_HIDESEEK_PHYSICS, 'cube'),
  plank: boxKindSize(DEFAULT_HIDESEEK_PHYSICS, 'plank'),
  ramp: boxKindSize(DEFAULT_HIDESEEK_PHYSICS, 'ramp'),
};

interface Props {
  kinds: BoxKind[];
  /** Players in the frame, so each box can find itself after them. */
  players: number;
  tier: HsQualityTier;
  onPointerDown?: BoxPointerHandler;
  onDoubleClick?: (index: number) => void;
}

/**
 * Every crate of the Sandbox match, in frame order, drawn with the same
 * braced crate and padlock hologram as the training arenas. A crate can be
 * dragged, and a double click locks or frees it.
 */
export function SandboxBoxes({ kinds, players, tier, onPointerDown, onDoubleClick }: Props) {
  const { frame } = useHsScene();
  const pose = useMemo(() => ({ x: 0, z: 0, yaw: 0 }), []);
  const readers = useMemo(
    () =>
      kinds.map((_, b) => (d: BoxDrive) => {
        const curr = sandboxFrame(frame);
        if (!curr) return false;
        const bits = readBox(frame, curr, players, b, pose);
        d.x = pose.x;
        d.z = pose.z;
        d.yaw = pose.yaw;
        d.locked = isLocked(bits);
      }),
    [frame, kinds, players, pose],
  );

  return (
    <group>
      {kinds.map((kind, b) => (
        <HsBox
          key={`${b}:${kind}`}
          kind={kind}
          size={SIZES[kind]}
          read={readers[b]}
          full={tier !== 'low'}
          shadows={tier !== 'low'}
          blob={tier === 'low'}
          onPointerDown={onPointerDown ? (e) => onPointerDown(b, e) : undefined}
          onDoubleClick={
            onDoubleClick
              ? (e) => {
                  e.stopPropagation();
                  onDoubleClick(b);
                }
              : undefined
          }
        />
      ))}
    </group>
  );
}
