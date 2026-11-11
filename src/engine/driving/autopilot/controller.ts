import type { AgentController, TickIO } from '../../env/types';
import type { DrivingLearner } from '../agent/learner';
import { builtinDrivingController } from '../builtinReward';
import type { DrivingBrain } from '../env';
import type { Autopilot } from './autopilot';

/** A brain that outputs nothing, for learners the autopilot drives. */
export const IDLE_BRAIN: DrivingBrain = { activate: () => {} };

/**
 * A controller that keeps the built in reward and stop rules but drives
 * with autopilots instead of the brain's outputs. `pilots` is filled after
 * the env exists (an autopilot reads the env's world), one per learner.
 */
export function autopilotController(pilots: Autopilot[], inner: AgentController<DrivingLearner> = builtinDrivingController): AgentController<DrivingLearner> {
  return {
    customSensorCount: inner.customSensorCount,
    sensors: (l, out, offset) => inner.sensors(l, out, offset),
    tick(l: DrivingLearner, io: TickIO) {
      inner.tick(l, io);
      pilots[l.index % pilots.length]?.drive(l, io.action);
    },
  };
}
