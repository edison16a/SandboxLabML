'use client';

import type { ThreeEvent } from '@react-three/fiber';
import { useMemo } from 'react';
import { BOX_COUNT, BOX_KINDS, boxSize, DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import { BoxOfKind, type BoxDrive } from '../boxes/HsBox';
import { useHsScene } from '../frame/sceneContext';
import { blendFloorPose, boxAt, boxLock } from '../frame/snapshotRead';

const SIZES = Array.from({ length: BOX_COUNT }, (_, i) => boxSize(DEFAULT_HIDESEEK_PHYSICS, i));

/** Called when a box is pressed, for Sandbox dragging. */
export type BoxPointerHandler = (index: number, e: ThreeEvent<PointerEvent>) => void;

/**
 * The boxes of the showcase arena, fed from the arena stream: the crates
 * and the ramp. A locked box lights its frame and raises a padlock
 * hologram in its owner's color. Given handlers, any box can be dragged
 * and double clicked.
 */
export function ShowcaseBoxes({ arena, tier, onBoxPointerDown, onBoxDoubleClick }: { arena: number; tier: HsQualityTier; onBoxPointerDown?: BoxPointerHandler; onBoxDoubleClick?: (index: number) => void }) {
  const { frame } = useHsScene();
  const pose = useMemo(() => ({ x: 0, z: 0, yaw: 0 }), []);
  const readers = useMemo(
    () =>
      SIZES.map((_, b) => (d: BoxDrive) => {
        const curr = frame.curr;
        if (!curr) return false;
        const o = boxAt(arena, b);
        blendFloorPose(frame.prev, curr, o, frame.alpha, pose);
        d.x = pose.x;
        d.z = pose.z;
        d.yaw = pose.yaw;
        d.lock = boxLock(curr, o);
      }),
    [frame, arena, pose],
  );

  return (
    <group>
      {SIZES.map((size, b) => (
        <BoxOfKind
          key={b}
          kind={BOX_KINDS[b]}
          size={size}
          read={readers[b]}
          full={tier !== 'low'}
          shadows={tier !== 'low'}
          blob={tier === 'low'}
          onPointerDown={onBoxPointerDown ? (e) => onBoxPointerDown(b, e) : undefined}
          onDoubleClick={
            onBoxDoubleClick
              ? (e) => {
                  e.stopPropagation();
                  onBoxDoubleClick(b);
                }
              : undefined
          }
        />
      ))}
    </group>
  );
}
