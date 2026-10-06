'use client';

import { useFrame } from '@react-three/fiber';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import { useRacingLab } from '@/features/racing/state/labStore';
import { blendField, blendPose, type Pose } from '@/render/shared/interpolate';
import { useRacingScene } from './sceneContext';

const STRIDE = RACING_SNAPSHOT.stride;
const pose: Pose = { x: 0, y: 0, heading: 0 };

/** Index of the car furthest along the road, preferring cars still driving. */
function findLeader(buf: Float32Array, count: number): number {
  let best = -1;
  let bestP = -Infinity;
  let bestAny = -1;
  let bestAnyP = -Infinity;
  for (let i = 0; i < count; i++) {
    const p = buf[i * STRIDE + 7];
    if (p > bestAnyP) {
      bestAnyP = p;
      bestAny = i;
    }
    if (buf[i * STRIDE + 6] === 0 && p > bestP) {
      bestP = p;
      best = i;
    }
  }
  return best >= 0 ? best : bestAny;
}

/**
 * Runs first every frame (negative priority) and works out the leader and
 * the focus pose from the latest snapshots and the user's focus choice.
 */
export function FrameDriver() {
  const { population, ghosts, frame, track } = useRacingScene();
  useFrame(() => {
    const { focus, view, mode } = useRacingLab.getState();
    // In the Sandbox the population stream holds the last training frame, so the camera only ever follows ghosts.
    const showPop = mode !== 'sandbox' && view !== 'overlay' && population?.curr && population.count > 0;
    const showGhosts = view !== 'population' && ghosts?.curr && ghosts.count > 0;
    frame.leader = population?.curr ? findLeader(population.curr.buffer, population.count) : -1;

    let stream: typeof population = null;
    let index = -1;
    if (focus.kind === 'car' && showPop && focus.index < population!.count) {
      stream = population;
      index = focus.index;
    } else if (focus.kind === 'ghost' && showGhosts) {
      const k = Array.from(ghosts!.tags).indexOf(focus.generation);
      if (k >= 0) {
        stream = ghosts;
        index = k;
      }
    }
    if (index < 0 && showPop && frame.leader >= 0) {
      stream = population;
      index = frame.leader;
    } else if (index < 0 && showGhosts) {
      stream = ghosts;
      // The newest champion's first car. In the Sandbox that is the copy on pole; otherwise it is the last ghost.
      index = ghosts!.tags.indexOf(ghosts!.tags[ghosts!.count - 1]);
    }

    frame.focusStream = stream ? stream.name === 'ghosts' ? 'ghosts' : 'population' : null;
    frame.focusIndex = index;
    frame.hiddenPopulation = stream === population ? index : -1;
    frame.hiddenGhost = stream === ghosts ? index : -1;
    if (!stream) {
      // Nothing streaming yet: frame the start line so the idle lab shows the grid, not open grass.
      frame.focusPos.set(track.cx[0], 0, -track.cy[0]);
      frame.focusYaw = Math.atan2(track.ty[0], track.tx[0]);
      frame.focusSpeed = 0;
    } else if (stream.curr && index >= 0) {
      const a = stream.alpha();
      const prev = stream.prev?.buffer ?? null;
      blendPose(prev, stream.curr.buffer, index * STRIDE, a, pose);
      frame.focusPos.set(pose.x, 0, -pose.y);
      frame.focusYaw = pose.heading;
      frame.focusSpeed = blendField(prev, stream.curr.buffer, index * STRIDE + 3, a);
    }
  }, -1);
  return null;
}
