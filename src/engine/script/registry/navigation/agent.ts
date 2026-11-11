import { wrapAngle } from '../../../core/math';
import { NEAR_CAP } from '../../../navigation/agent';
import { MAX_COURSE_LENGTH } from '../../../navigation/course/types';
import { DEFAULT_NAVIGATION_PARAMS } from '../../../navigation/params';
import type { RegistryEntry } from '../types';
import { boolSensor, numSensor, runner } from './sensor';

const P = DEFAULT_NAVIGATION_PARAMS.agent;

/** What a runner knows about its own run: how far it got, what just happened and how much time is left. */
export const NAVIGATION_AGENT_ENTRIES: RegistryEntry[] = [
  numSensor(
    {
      name: 'agent.progress',
      unit: '',
      range: [0, 1],
      summary: 'How much of its walk to the finish the runner has covered, from 0 to 1.',
      description: 'Measured along the shortest path round the obstacles, from its own start spot. It is 1 at the finish line, and a runner pushed back loses some of it.',
      example: 'reward +1 when agent.progress > 0.5',
      explain: "the runner's progress",
      label: 'progress',
      progress: true,
    },
    (v) => runner(v).progress,
  ),
  numSensor(
    {
      name: 'agent.progressGain',
      unit: '',
      range: [0, 1],
      summary: 'How much new ground the runner covered this tick, as a share of its walk.',
      description: 'Zero unless the runner got closer to the finish than it has ever been. Rewarding it pays once for every bit of the way, so a whole run is worth the same however long it takes.',
      example: 'reward +10 * agent.progressGain',
      explain: 'the new ground covered this tick',
      label: 'new ground',
      progress: true,
    },
    (v) => runner(v).progressGain,
  ),
  boolSensor(
    {
      name: 'agent.finished',
      unit: '',
      summary: 'True on the tick the runner crosses the finish line.',
      description: 'The run ends right after this tick. Reward it to make finishing worth more than getting close.',
      example: 'reward +10 when agent.finished',
      explain: 'the runner crosses the line',
      label: 'crosses the line',
    },
    (v) => runner(v).finishedNow,
  ),
  boolSensor(
    {
      name: 'agent.died',
      unit: '',
      summary: 'True on the tick the runner steps on spikes or is crushed by a mover.',
      description: 'The run ends right after this tick. A penalty here teaches runners to keep clear of spikes and to time the movers.',
      example: 'reward -3 when agent.died',
      explain: 'the runner dies',
      label: 'dies',
    },
    (v) => runner(v).diedNow,
  ),
  numSensor(
    {
      name: 'agent.distanceLeft',
      unit: 'm',
      range: [0, MAX_COURSE_LENGTH * 2],
      summary: 'Walking distance left to the finish line.',
      description: 'Meters along the shortest path that goes round crates and walls and keeps clear of spikes. It shrinks as the runner closes in and is 0 on the line.',
      example: 'reward +0.01 when agent.distanceLeft < 5 m',
      explain: 'the distance left',
      label: 'distance left',
    },
    (v) => runner(v).distanceLeft,
  ),
  numSensor(
    {
      name: 'agent.goalBearing',
      unit: 'rad',
      range: [-Math.PI, Math.PI],
      summary: 'Angle from where the runner faces to the finish, positive to the left.',
      description: 'Zero when it faces straight down the room toward the line. A runner turned the other way reads close to pi.',
      example: 'reward -0.002 when abs(agent.goalBearing) > 90 deg',
      explain: 'the angle to the finish',
      label: 'finish bearing',
    },
    (v) => wrapAngle(-runner(v).yaw),
  ),
  numSensor(
    {
      name: 'agent.speed',
      unit: 'm/s',
      range: [-P.maxSpeed * P.backShare, P.maxSpeed],
      summary: 'How fast the runner is moving forward.',
      description: 'Forward speed in meters per second, negative when backing up. Runners top out at 4 m/s forward and half that backward.',
      example: 'reward -0.005 when agent.speed < 0.3 m/s',
      explain: "the runner's speed",
      label: 'speed',
    },
    (v) => runner(v).speed,
  ),
  numSensor(
    {
      name: 'agent.time',
      unit: 's',
      range: [0, 120],
      summary: 'Seconds since the run started.',
      description: 'Counts up from 0 on the start grid. Use it to pay more for an early finish.',
      example: 'reward +5 when agent.finished and agent.time < 10 s',
      explain: 'the time so far',
      label: 'time',
    },
    (v) => runner(v).time,
  ),
  numSensor(
    {
      name: 'agent.timeLeft',
      unit: 's',
      range: [0, 120],
      summary: 'Seconds until the run ends for time.',
      description: 'Each course gives a runner time for a slow, careful walk with a margin. A finish with time to spare can be worth more.',
      example: 'reward +0.5 * agent.timeLeft / 1 s when agent.finished',
      explain: 'the time left',
      label: 'time left',
    },
    (v) => Math.max(0, runner(v).timeLimit - runner(v).time),
  ),
  numSensor(
    {
      name: 'agent.stuckTime',
      unit: 's',
      range: [0, 10],
      summary: 'Seconds since the runner last got closer to the finish.',
      description: 'It resets whenever the runner makes new ground. A run with no new ground for a few seconds ends as stuck, unless it waits right by a mover.',
      example: 'reward -0.01 when agent.stuckTime > 2 s',
      explain: 'the time without new ground',
      label: 'time stuck',
    },
    (v) => runner(v).noProgress,
  ),
  boolSensor(
    {
      name: 'agent.touching',
      unit: '',
      summary: 'True while the runner is pressed against a wall, a crate or a mover.',
      description: 'Runners slide along whatever they touch, so touching is not fatal. A small penalty teaches them to keep some room.',
      example: 'reward -0.002 when agent.touching',
      explain: 'the runner touches something',
      label: 'touching',
    },
    (v) => runner(v).touching,
  ),
  numSensor(
    {
      name: 'agent.spikeDistance',
      unit: 'm',
      range: [0, NEAR_CAP],
      summary: 'Gap between the runner and the nearest spikes.',
      description: `Meters from the edge of its body to the nearest spike pad, capped at ${NEAR_CAP} m. It is 0 when the runner is on them.`,
      example: 'reward -0.002 when agent.spikeDistance < 0.5 m',
      explain: 'the gap to the spikes',
      label: 'spike gap',
    },
    (v) => runner(v).spikeDistance,
  ),
  numSensor(
    {
      name: 'agent.moverDistance',
      unit: 'm',
      range: [0, NEAR_CAP],
      summary: 'Gap between the runner and the nearest moving crate.',
      description: `Meters from the edge of its body to the nearest mover where it stands now, capped at ${NEAR_CAP} m. Movers push runners and crush any caught against a wall.`,
      example: 'reward -0.002 when agent.moverDistance < 0.3 m',
      explain: 'the gap to the movers',
      label: 'mover gap',
    },
    (v) => runner(v).moverDistance,
  ),
];
