import type { RegistryEntry } from '../types';
import { ALL_TIERS, boolSensor, car, numSensor } from './sensor';

/** Checkpoints and laps: the events that tell a car it is getting somewhere. */
export const RACING_PROGRESS_ENTRIES: RegistryEntry[] = [
  boolSensor(
    {
      name: 'checkpoint.passed',
      unit: '',
      summary: 'True on the tick the car passes a checkpoint.',
      description: 'Checkpoints sit every 10 m along the road. This is true for exactly one tick each time the car crosses the next one, which makes it the simplest progress reward.',
      example: 'reward +1 when checkpoint.passed',
      explain: 'the car passes a checkpoint',
      label: 'checkpoint passed',
      presets: ALL_TIERS,
      progress: true,
      renamedFrom: ['checkpoint.hit'],
    },
    () => (v) => car(v).checkpointPassed,
  ),
  numSensor(
    {
      name: 'checkpoint.distance',
      unit: 'm',
      summary: 'Meters along the road to the next checkpoint.',
      description: 'Shrinks as the car approaches the next checkpoint and jumps back up to about 10 m once it passes. Useful as a custom brain input.',
      example: 'reward +0.01 when checkpoint.distance < 2 m',
      explain: 'the distance to the next checkpoint',
      label: 'distance to checkpoint',
      progress: true,
    },
    () => (v) => car(v).checkpointDistance,
  ),
  numSensor(
    {
      name: 'checkpoint.count',
      unit: '',
      summary: 'Checkpoints passed so far in this episode.',
      description: 'Counts every checkpoint since the start, across laps.',
      example: 'stop "done" when checkpoint.count >= 100',
      explain: 'the number of checkpoints passed',
      label: 'checkpoints passed',
      progress: true,
    },
    () => (v) => car(v).checkpointsPassed,
  ),
  boolSensor(
    {
      name: 'lap.completed',
      unit: '',
      summary: 'True on the tick the car finishes a lap.',
      description: 'True for exactly one tick each time the car crosses the start line after a full lap. A big lap bonus teaches cars that finishing matters more than any single corner.',
      example: 'reward +10 when lap.completed',
      explain: 'the car finishes a lap',
      label: 'lap completed',
      presets: ['intermediate', 'advanced'],
      progress: true,
    },
    () => (v) => car(v).lapCompleted,
  ),
  numSensor(
    {
      name: 'lap.count',
      unit: '',
      summary: 'Laps finished so far.',
      description: 'Starts at 0 and goes up by one each time lap.completed is true.',
      example: 'stop "finished" when lap.count >= 3',
      explain: 'the number of laps finished',
      label: 'laps finished',
      progress: true,
    },
    () => (v) => car(v).lap,
  ),
  numSensor(
    {
      name: 'lap.time',
      unit: 's',
      summary: 'Seconds since the current lap began.',
      description: 'Restarts at zero each time a lap is finished.',
      example: 'stop "slow lap" when lap.time > 90 s',
      explain: 'the time on this lap',
      label: 'lap time',
    },
    () => (v) => car(v).lapTime,
  ),
  numSensor(
    {
      name: 'lap.best',
      unit: 's',
      summary: 'Fastest finished lap so far, or 0 before the first one.',
      description: 'The best lap time of this car in this episode. It stays 0 until the first lap is done, so check lap.count before comparing it.',
      example: 'reward +5 when lap.completed and lap.best < 30 s',
      explain: 'the best lap time',
      label: 'best lap',
    },
    () => (v) => car(v).bestLapTime,
  ),
];
