'use client';

import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { blendField, blendPose, type Pose } from '@/render/shared/interpolate';
import { useRacingScene } from '@/render/racing/sceneContext';

const pose: Pose = { x: 0, y: 0, heading: 0 };
/** Frames drawn with the car on the road before the scene counts as shown. The first ones compile shaders and can come out half lit. */
const SETTLE_FRAMES = 4;

/**
 * Runs first every frame and points the shared racing frame at the hero
 * car, the only car on the road, so the lab's car, camera target and
 * shadows follow it. It calls onShown once the car has been on screen for
 * a few frames, which is when the live view may cover the poster.
 */
export function HeroCarDriver({ onShown }: { onShown: () => void }) {
  const { ghosts, frame, track } = useRacingScene();
  const drawn = useRef(0);

  useFrame(() => {
    const curr = ghosts?.curr;
    if (!ghosts || !curr || ghosts.count === 0) {
      frame.focusStream = null;
      frame.focusIndex = -1;
      frame.focusPos.set(track.cx[0], 0, -track.cy[0]);
      frame.focusYaw = Math.atan2(track.ty[0], track.tx[0]);
      frame.focusSpeed = 0;
      return;
    }
    const a = ghosts.alpha();
    const prev = ghosts.prev?.buffer ?? null;
    blendPose(prev, curr.buffer, 0, a, pose);
    frame.focusStream = 'ghosts';
    frame.focusIndex = 0;
    frame.hiddenGhost = 0;
    frame.hiddenPopulation = -1;
    frame.focusPos.set(pose.x, 0, -pose.y);
    frame.focusYaw = pose.heading;
    frame.focusSpeed = blendField(prev, curr.buffer, 3, a);
    if (drawn.current < SETTLE_FRAMES && ++drawn.current === SETTLE_FRAMES) onShown();
  }, -1);
  return null;
}
