import type { AgentController } from '../../env/types';
import type { HideSeekAgent } from '../agents/agent';
import type { HideSeekInputConfig } from '../inputConfig';
import type { HideSeekPhysics } from '../physics';
import type { SandboxRoom } from './room';

/** What the Sandbox needs from a brain: one forward pass, and the shape to check it against its inputs. */
export interface SandboxBrain {
  readonly inputCount: number;
  readonly outputCount: number;
  activate(inputs: ArrayLike<number>, out: Float64Array): void;
}

/** One team of trained players. */
export interface SandboxTeamSetup {
  /**
   * Builds the brain of one player, called once per slot with the slot
   * number. Each player gets its own, so the worker can show and lesion
   * any of them.
   */
  brain: (slot: number) => SandboxBrain;
  /** Exactly the inputs this team was trained with. */
  inputs: HideSeekInputConfig;
  /**
   * The run's script controller for this team, when the script adds
   * sensors the brain was trained with. Only its sensors are read: brain
   * outputs drive the player directly and nothing is rewarded, like the
   * benchmark. Built once per player from the player's own seed.
   */
  sensors: ((seed: number) => AgentController<HideSeekAgent>) | null;
}

export interface SandboxOptions {
  room: SandboxRoom;
  /** Fixes every spawn pose, the sensor noise and the script sensors' randomness. */
  seed: number;
  hiders: number;
  seekers: number;
  hider: SandboxTeamSetup;
  seeker: SandboxTeamSetup;
  /** The rules the brains were trained under. */
  physics: HideSeekPhysics;
  /** Prep phase length, s. Defaults to the physics prepShare of the match. */
  prepSeconds?: number;
}
