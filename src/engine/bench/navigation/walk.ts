import type { AgentController, CustomSensorSpec, TickIO } from '../../env/types';
import type { NavAgent } from '../../navigation/agent';
import { NavigationEnv } from '../../navigation/env';
import { DEFAULT_NAVIGATION_PARAMS } from '../../navigation/params';
import type { NavigationInputConfig } from '../../navigation/sensors/inputConfig';
import { Network } from '../../neat/network';
import type { Genome } from '../../neat/types';
import { EXAM_SLOTS, type ExamRoom } from './exam';
import type { ExamRun } from './scoring';

/** The parts of a run the exam needs: the brain's inputs and the script's own sensors, if any. */
export interface ExamWalker {
  inputs: NavigationInputConfig;
  customSensors: CustomSensorSpec[];
  /** Builds the script's controller for a room. Only its sensors are used. */
  sensorsFor(seed: number, room: ExamRoom): AgentController<NavAgent> | null;
}

/**
 * The exam's controller. It feeds the brain the script's own sensors, so a
 * brain sees what it learned with, but passes its outputs straight to the
 * legs and never rewards or stops anything. Only the room's own rules end
 * a run (the line, spikes, a mover, the clock or no new ground), so
 * training rewards cannot change a score.
 */
function examController(script: AgentController<NavAgent> | null): AgentController<NavAgent> {
  return {
    customSensorCount: script?.customSensorCount ?? 0,
    sensors(view, out, offset) {
      script?.sensors(view, out, offset);
    },
    tick(_view, io: TickIO) {
      io.action[0] = io.brain[0];
      io.action[1] = io.brain[1];
    },
  };
}

/** Runs one brain through one room from every exam slot, alone each time, and returns the runs in slot order. */
export function walkRoom(genome: Genome, room: ExamRoom, walker: ExamWalker, seed: number): ExamRun[] {
  return EXAM_SLOTS.map((slot, k) => {
    const env = new NavigationEnv({
      course: room.course,
      params: DEFAULT_NAVIGATION_PARAMS,
      inputs: walker.inputs,
      controller: examController(walker.sensorsFor(seed + k, room)),
      customSensors: walker.customSensors,
    });
    env.reset([new Network(genome)], [seed + k], [slot]);
    while (!env.done) env.step();
    const r = env.results()[0];
    return { progress: r.progress, finished: r.finished, died: r.died, finishTime: r.finishTime, par: room.par[k], hazards: room.hazards };
  });
}
