/**
 * Contracts shared by every environment. The renderer, the inputs overlay,
 * the network graph and the script compiler all read these instead of
 * knowing about Racing or Hide and Seek directly.
 */

export type EnvId = 'racing' | 'hideseek';

/** One brain input, described well enough to label it and draw it in 3D. */
export interface InputSpec {
  index: number;
  /** Stable identifier, e.g. "ray:3" or "speed". Survives forks and relabels. */
  key: string;
  label: string;
  group: 'ray' | 'scalar' | 'custom';
  unit: string;
  /** Real value = normalized * scale + offset. Lets the overlay show meters, not 0.73. */
  scale: number;
  offset: number;
  /** For rays: direction relative to the agent's facing (radians, left positive) and length. */
  ray?: { angle: number; maxLength: number };
}

export interface OutputSpec {
  index: number;
  key: string;
  label: string;
}

/** Fixed-stride snapshot description so renderers can read raw Float32Arrays. */
export interface SnapshotLayout {
  stride: number;
  fields: readonly string[];
}

/**
 * What the per-tick controller (built-in reward or a compiled script) reads
 * and writes. One instance is reused for every agent to avoid allocation.
 */
export interface TickIO {
  /** Brain outputs for this tick, in output order. */
  brain: Float64Array;
  /** Actions the environment applies on the next physics step. */
  action: Float64Array;
  reward: number;
  stop: string | null;
}

/**
 * Turns brain outputs into actions and rewards for one agent. The built-in
 * reward and every compiled script implement this.
 */
export interface AgentController<View> {
  /** Extra script-defined sensors, already normalized to [0, 1]. */
  readonly customSensorCount: number;
  sensors(view: View, out: Float64Array, offset: number): void;
  tick(view: View, io: TickIO): void;
}

export function makeTickIO(outputs: number, actions: number): TickIO {
  return { brain: new Float64Array(outputs), action: new Float64Array(actions), reward: 0, stop: null };
}
