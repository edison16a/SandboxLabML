import type { RacingBlueprint } from '@/engine/blueprints/types';
import type { Genome } from '@/engine/neat/types';
import type { CarParams } from '@/engine/racing/car/params';

/** The brain to drive with: a fresh random one for the script's blueprint, or a stored champion with the settings it trained under. */
export type TestBrain =
  | { kind: 'random'; seed: number }
  | { kind: 'champion'; genome: Genome; blueprint: RacingBlueprint; car: CarParams; maxTime: number; label: string };

export interface TestRunRequest {
  source: string;
  trackId: string;
  brain: TestBrain;
  /** Seeds sensor noise and the script's rand(). */
  seed: number;
}

/** Per tick columns, as typed arrays so the worker can hand them over without copying. */
export interface TickLog {
  time: Float32Array;
  reward: Float32Array;
  total: Float32Array;
  speed: Float32Array;
  /** Ticks where something happened, such as a checkpoint or the stop. */
  events: Array<{ tick: number; text: string }>;
}

export interface TestRunOk {
  ok: true;
  ticks: number;
  log: TickLog;
  stopReason: string;
  totalReward: number;
  distance: number;
  laps: number;
  /** The script alone, measured in a tight loop over states from this run. */
  scriptMicros: number;
  /** A whole tick for one car: physics, rays, brain and script. */
  tickMicros: number;
  /** Share of built-in Turbo speed the script keeps, 0 to 1. */
  turboShare: number;
  blueprint: string;
}

export type TestRunResult = TestRunOk | { ok: false; message: string };
