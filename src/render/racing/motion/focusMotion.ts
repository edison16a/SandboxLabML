import { DEFAULT_CAR, type CarParams } from '@/engine/racing/car/params';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import type { Track } from '@/engine/racing/track/types';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import type { RacingFrame } from '../sceneContext';
import { readTickMotion } from './tickMotion';
import { readContact } from './wheelContact';

/** Gaps between snapshots longer than this many ticks are a restart or a stall, not motion. */
const MAX_GAP = 20;

/**
 * Fills the frame's motion facts for the followed car: its accelerations
 * over the latest tick (once per new snapshot) and what its tires touch
 * this frame. The car body, tire smoke and camera all read these, so they
 * agree with each other and with the simulation.
 */
export function updateFocusMotion(frame: RacingFrame, stream: SnapshotStream | null, index: number, track: Track, car: CarParams = DEFAULT_CAR): void {
  const m = frame.motion;
  const curr = stream?.curr;
  const prev = stream?.prev;
  if (!curr || !prev || index < 0) {
    m.accelLong = m.accelLat = m.usage = m.push = m.yawRate = 0;
    frame.motionTick = -1;
    return;
  }
  if (curr.tick !== frame.motionTick || frame.motionIndex !== index) {
    const ticks = curr.tick - prev.tick;
    if (ticks > 0 && ticks <= MAX_GAP) readTickMotion(prev.buffer, curr.buffer, index * RACING_SNAPSHOT.stride, ticks, car, m);
    else m.accelLong = m.accelLat = m.usage = m.push = m.yawRate = 0;
    frame.motionTick = curr.tick;
    frame.motionIndex = index;
  }
  readContact(track, frame.focusPos.x, -frame.focusPos.z, frame.focusYaw, frame.contact);
}
