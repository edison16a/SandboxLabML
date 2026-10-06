import { clamp } from '../../core/math';
import { makeTickIO, type AgentController, type TickIO } from '../../env/types';
import type { HideSeekAgent } from '../../hideseek/agents/agent';
import { bearing } from '../../hideseek/frame';
import { HIDESEEK_OUTPUT_COUNT } from '../../hideseek/inputConfig';
import type { BoxState } from '../../hideseek/match/state';
import { scriptedHiderController } from '../../hideseek/scriptedHider';
import { scriptedSeekerController } from '../../hideseek/scriptedSeeker';

/**
 * Writes what a test player wants this tick into `out`, in brain output
 * order (move, turn, grab, lock). The script then reads it as brain.move
 * and friends, exactly as it would read a trained brain.
 */
export type TestBrain = (a: HideSeekAgent, out: Float64Array) => void;

/** Seconds the test hider carries a box before it sets it down and locks it. */
const CARRY_SECONDS = 1;
/** Within this bearing of a box, rad, the test hider walks at full speed. */
const ON_COURSE = 0.5;

/**
 * Wraps the script's own controller so it reads the test player's outputs
 * as the brain. The script still decides everything else: whether act
 * passes those outputs on, what scores and when to stop.
 */
export function withTestBrain(controller: AgentController<HideSeekAgent>, brain: TestBrain): AgentController<HideSeekAgent> {
  return {
    customSensorCount: controller.customSensorCount,
    sensors: (a, out, offset) => controller.sensors(a, out, offset),
    tick(a, io) {
      brain(a, io.brain);
      controller.tick(a, io);
    },
  };
}

/** The moves a hand-written agent would make this tick, copied into `out`. Its own scoring is thrown away. */
function movesOf(agent: AgentController<HideSeekAgent>, a: HideSeekAgent, scratch: TickIO, out: Float64Array): void {
  scratch.brain.fill(0);
  agent.tick(a, scratch);
  out.set(scratch.action);
}

/**
 * The test seeker plays like the scripted seeker: it chases what it sees,
 * heads for the last sighting for a while, and otherwise sweeps the room.
 * It never touches boxes.
 */
export function testSeekerBrain(): TestBrain {
  const scratch = makeTickIO(HIDESEEK_OUTPUT_COUNT, HIDESEEK_OUTPUT_COUNT);
  return (a, out) => movesOf(scriptedSeekerController, a, scratch, out);
}

/**
 * The test hider uses prep to work with boxes: it walks to the nearest
 * free box with grab on, carries it for a second, then lets go and locks
 * it in the same tick, and moves on to the next one. Once the seeker is
 * loose it plays like the scripted hider, running from sightings and
 * wandering. A script that never passes grab or lock to act just sees it
 * walk up to boxes.
 *
 * It reads where the boxes are from the match, which a brain cannot.
 * That is fine for a fixed test player and keeps it from getting stuck on
 * a box it already locked. Call `watch` with the match's boxes first.
 */
export class TestHider {
  private boxes: readonly BoxState[] = [];
  private carriedSince = -1;
  private readonly scratch = makeTickIO(HIDESEEK_OUTPUT_COUNT, HIDESEEK_OUTPUT_COUNT);

  watch(boxes: readonly BoxState[]): void {
    this.boxes = boxes;
  }

  readonly brain: TestBrain = (a, out) => {
    if (!a.prep) {
      this.carriedSince = -1;
      movesOf(scriptedHiderController, a, this.scratch, out);
      return;
    }
    if (a.holding) {
      if (this.carriedSince < 0) this.carriedSince = a.time;
      const done = a.time - this.carriedSince >= CARRY_SECONDS;
      out.set([0, 0, done ? -1 : 1, done ? 1 : -1]);
      return;
    }
    this.carriedSince = -1;
    const box = this.nearestFreeBox(a);
    if (!box) {
      out.set([0, 0, -1, -1]);
      return;
    }
    const b = bearing(box.x - a.x, box.z - a.z, a.yaw);
    out.set([Math.abs(b) < ON_COURSE ? 1 : 0.2, clamp(b * 2, -1, 1), 1, -1]);
  };

  /** The closest box nobody has locked or picked up, or null when every box is taken. */
  private nearestFreeBox(a: HideSeekAgent): BoxState | null {
    let best: BoxState | null = null;
    let bestDistance = Infinity;
    for (const b of this.boxes) {
      if (b.lockedBy >= 0 || b.heldBy >= 0) continue;
      const d = Math.hypot(b.x - a.x, b.z - a.z);
      if (d < bestDistance) {
        best = b;
        bestDistance = d;
      }
    }
    return best;
  }
}
