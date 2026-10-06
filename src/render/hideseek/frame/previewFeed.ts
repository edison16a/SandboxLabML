import { getLayout, HIDESEEK_LAYOUT_IDS } from '@/engine/hideseek/layouts/presets';
import { layoutSetup } from '@/engine/hideseek/layouts/spawn';
import type { HideSeekLayoutId } from '@/engine/hideseek/layouts/types';
import type { ArenaFeed } from '@/workers/client/arenaFeed';
import { agentAt, boxAt, STRIDE } from './snapshotRead';

/**
 * A still frame of `count` arenas laid out as the room is drawn, agents
 * facing each other, for an idle lab before any round has streamed. It
 * looks like any other feed, so the renderer has a single code path.
 */
export function previewFeed(layoutId: HideSeekLayoutId, count: number): ArenaFeed {
  const layout = getLayout(layoutId);
  const setup = layoutSetup(layout);
  const [h, s] = setup.agents;
  const buffer = new Float32Array(count * STRIDE);
  for (let i = 0; i < count; i++) {
    buffer[i * STRIDE + 1] = 1;
    const facing = [Math.atan2(-(s.z - h.z), s.x - h.x), Math.atan2(-(h.z - s.z), h.x - s.x)];
    setup.agents.forEach((a, k) => buffer.set([a.x, a.z, facing[k], 0], agentAt(i, k)));
    setup.boxes.forEach((b, k) => buffer.set([b.x, b.z, b.yaw, 0], boxAt(i, k)));
  }
  const tag = HIDESEEK_LAYOUT_IDS.indexOf(layoutId);
  return {
    prev: null,
    curr: { buffer, tick: 0, at: 0 },
    count,
    generation: 0,
    tags: new Int32Array(count).fill(tag),
    inspect: null,
    rays: null,
    // Negative so it never matches a real stream's epoch, and distinct per preview.
    epoch: -1 - tag - 8 * count,
    alpha: () => 1,
    subscribe: () => {},
    on: () => () => {},
  };
}
