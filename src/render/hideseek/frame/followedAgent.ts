import type { HsFrame } from './sceneContext';
import { agentAt, blendFloorPose, type FloorPose } from './snapshotRead';

/**
 * Where agent `agent` (0 hider, 1 seeker) of drawn slot `slot` stands,
 * blended between frames, and its flags. Scenes whose stream is not laid
 * out as arenas answer through `frame.agentPose` instead. Returns -1 when
 * there is nothing to follow.
 */
export function followedAgent(frame: HsFrame, slot: number, agent: number, out: FloorPose): number {
  if (frame.agentPose) return frame.agentPose(agent, out);
  const curr = frame.curr;
  if (!curr) return -1;
  const o = agentAt(frame.first + slot, agent);
  blendFloorPose(frame.prev, curr, o, frame.alpha, out);
  return curr[o + 3];
}
