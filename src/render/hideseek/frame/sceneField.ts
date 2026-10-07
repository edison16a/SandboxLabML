import { BOX_COUNT, BOX_KINDS, boxKindSize, DEFAULT_HIDESEEK_PHYSICS, type BoxKind } from '@/engine/hideseek/physics';
import { sandboxAgentAt, sandboxBoxAt, sandboxBoxKind, sandboxHiderCount } from '@/engine/hideseek/sandbox/snapshot';
import type { Rect } from '@/engine/hideseek/layouts/types';
import { SANDBOX_LIMITS } from '@/engine/hideseek/sandbox/room';
import { AGENT_FLAGS, FLAG_FROZEN } from '@/engine/hideseek/snapshot';
import { boxShape, type BoxShape } from '../characters/perception';
import { boxBits, sandboxPlayerCount, seekerIdle } from '../sandbox/sandboxRead';
import type { HsFrame } from './sceneContext';
import { agentAt, agentFlags, blendAgentPose, blendFloorPose, boxAt, hasFlag, type AgentPose } from './snapshotRead';

const P = DEFAULT_HIDESEEK_PHYSICS;
const MAX_PLAYERS = SANDBOX_LIMITS.playersPerTeam * 2;
const MAX_BOXES = Math.max(SANDBOX_LIMITS.boxes, BOX_COUNT);

/** One agent as the others see it this frame: where it stands, on which team, and whether it is asleep. */
export interface FieldAgent extends AgentPose {
  team: 0 | 1;
  frozen: boolean;
}

/**
 * Every box and agent of the arena on screen, read once a frame (before
 * the characters pose) from the same blended snapshot the scene draws, so
 * a character can find the box under its hands and the agents worth
 * looking at without each one reading the stream again. Fixed size, so it
 * allocates nothing per frame.
 */
export class SceneField {
  readonly boxes: BoxShape[] = Array.from({ length: MAX_BOXES }, boxShape);
  readonly agents: FieldAgent[] = Array.from({ length: MAX_PLAYERS }, () => ({ x: 0, z: 0, yaw: 0, elevation: 0, team: 0, frozen: false }));
  /** The walls of the room on screen, set by the scene that owns them; never copied. */
  walls: readonly Rect[] = [];
  boxCount = 0;
  agentCount = 0;

  /** Arena `arena` of an arena stream: one hider, one seeker and the five boxes of every layout. */
  readArena(frame: HsFrame, arena: number): void {
    const curr = frame.curr;
    if (!curr) return void (this.boxCount = this.agentCount = 0);
    for (let b = 0; b < BOX_COUNT; b++) {
      blendFloorPose(frame.prev, curr, boxAt(arena, b), frame.alpha, this.boxes[b]);
      setSize(this.boxes[b], BOX_KINDS[b]);
    }
    for (let a = 0; a < 2; a++) {
      const agent = this.agents[a];
      blendAgentPose(frame.prev, curr, agentAt(arena, a), frame.alpha, agent);
      agent.team = a as 0 | 1;
      agent.frozen = hasFlag(agentFlags(curr, agentAt(arena, a)), FLAG_FROZEN);
    }
    this.boxCount = BOX_COUNT;
    this.agentCount = 2;
  }

  /** A Sandbox frame: any number of players and boxes of any kind. */
  readSandbox(frame: HsFrame, curr: Float32Array, players: number, boxes: number): void {
    const prev = frame.prev && frame.prev.length === curr.length ? frame.prev : null;
    const hiders = sandboxHiderCount(curr);
    this.agentCount = Math.min(players, MAX_PLAYERS);
    for (let s = 0; s < this.agentCount; s++) {
      const agent = this.agents[s];
      blendAgentPose(prev, curr, sandboxAgentAt(s), frame.alpha, agent);
      agent.team = s < hiders ? 0 : 1;
      // A seeker in prep sleeps like a frozen one, as SandboxAgent draws it.
      const flags = curr[sandboxAgentAt(s) + AGENT_FLAGS];
      agent.frozen = s < hiders ? hasFlag(flags, FLAG_FROZEN) : seekerIdle(curr, flags);
    }
    this.boxCount = Math.min(boxes, MAX_BOXES);
    for (let b = 0; b < this.boxCount; b++) {
      blendFloorPose(prev, curr, sandboxBoxAt(sandboxPlayerCount(curr), b), frame.alpha, this.boxes[b]);
      setSize(this.boxes[b], sandboxBoxKind(boxBits(curr, players, b)));
    }
  }

  /** The nearest awake agent of team `team` to (x, z), or -1. A sleeping one is not worth a look, so a nearer sleeper never hides an awake one further off. */
  nearest(team: 0 | 1, x: number, z: number): number {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < this.agentCount; i++) {
      const a = this.agents[i];
      if (a.team !== team || a.frozen) continue;
      const d = Math.hypot(a.x - x, a.z - z);
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }
}

function setSize(s: BoxShape, kind: BoxKind): void {
  const size = boxKindSize(P, kind);
  s.length = size.length;
  s.width = size.width;
  s.height = size.height;
  s.ramp = kind === 'ramp';
}
