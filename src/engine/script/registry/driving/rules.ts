import type { RegistryEntry } from '../types';
import { boolSensor, learner } from './sensor';

/** The rules of the road a driving script can reward or punish. Each is true on the tick it happens or while it lasts. */
export const DRIVING_RULE_ENTRIES: RegistryEntry[] = [
  boolSensor(
    {
      name: 'rules.ranRedLight',
      unit: '',
      summary: 'True on the tick the SUV enters a junction on red.',
      description: 'The light is read as the front of the SUV crosses the stop line and judged as it enters the junction. Lights cycle from the second level on.',
      example: 'reward -2 when rules.ranRedLight',
      explain: 'the SUV runs a red light',
      label: 'ran a red light',
    },
    () => (v) => learner(v).ranRedLight,
  ),
  boolSensor(
    {
      name: 'rules.overranStopLine',
      unit: '',
      summary: 'True on the tick the SUV rolls past a stop line it should have stopped at.',
      description: 'The light was red at the line but turned green before the SUV reached the junction. It is a near miss rather than a red light run, so it usually costs less.',
      example: 'reward -0.3 when rules.overranStopLine',
      explain: 'the SUV rolls past a stop line',
      label: 'overran a stop line',
    },
    () => (v) => learner(v).overranStopLine,
  ),
  boolSensor(
    {
      name: 'rules.speeding',
      unit: '',
      summary: 'True while the SUV drives over the speed limit.',
      description: 'The limit is 13.9 m/s in town and lower in slow zones. A little over is allowed before it counts.',
      example: 'reward -0.005 when rules.speeding',
      explain: 'the SUV is speeding',
      label: 'speeding',
    },
    () => (v) => learner(v).speeding,
  ),
  boolSensor(
    {
      name: 'rules.wrongWay',
      unit: '',
      summary: 'True while the SUV is over the center line.',
      description: 'Streets have one lane each way and traffic keeps to the right. Inside a junction the SUV may cross the center line to turn.',
      example: 'reward -0.01 when rules.wrongWay',
      explain: 'the SUV is on the wrong side',
      label: 'wrong side of the road',
    },
    () => (v) => learner(v).wrongWay,
  ),
  boolSensor(
    {
      name: 'rules.laneDeparture',
      unit: '',
      summary: 'True while the SUV drifts out of its lane.',
      description: 'The body is across a lane line when the SUV is more than about a meter from the middle of its lane. Junctions do not count.',
      example: 'reward -0.002 when rules.laneDeparture',
      explain: 'the SUV leaves its lane',
      label: 'out of its lane',
    },
    () => (v) => learner(v).laneDeparture,
  ),
];
