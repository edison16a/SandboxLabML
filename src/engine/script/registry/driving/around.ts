import { LIGHT_GREEN, LIGHT_RED, LIGHT_YELLOW } from '../../../driving/signals/plan';
import { GAP_RANGE, PED_RANGE, STOP_RANGE } from '../../../driving/sensors/inputConfig';
import { entry } from '../define';
import type { Reader, RegistryEntry } from '../types';
import { boolSensor, learner, numSensor } from './sensor';

/**
 * What the SUV senses around it: the light it is heading for, the car in
 * front, the nearest person in its path and its lidar. These are the same
 * numbers the brain's inputs are made from, before they are scaled.
 */
export const DRIVING_AROUND_ENTRIES: RegistryEntry[] = [
  boolSensor(
    {
      name: 'light.red',
      unit: '',
      summary: 'True while the next traffic light on the route is red.',
      description: `Only a light within ${STOP_RANGE} m counts. On empty streets the lights are off and this is never true.`,
      example: 'reward +0.005 when light.red and light.distance < 25 m and car.speed < 1 m/s',
      explain: 'the light ahead is red',
      label: 'light is red',
    },
    () => (v) => learner(v).sense.light === LIGHT_RED,
  ),
  boolSensor(
    {
      name: 'light.yellow',
      unit: '',
      summary: 'True while the next traffic light on the route is yellow.',
      description: 'Yellow lasts 3 s before red. A SUV close to the line may still go; one further back should stop.',
      example: 'reward -0.01 when light.yellow and light.distance > 20 m and car.speed > 8 m/s',
      explain: 'the light ahead is yellow',
      label: 'light is yellow',
    },
    () => (v) => learner(v).sense.light === LIGHT_YELLOW,
  ),
  boolSensor(
    {
      name: 'light.green',
      unit: '',
      summary: 'True while the next traffic light on the route is green.',
      description: 'Green lasts 15 s. Left turns go on the same green, so the brain still has to wait for oncoming cars.',
      example: 'reward -0.002 when light.green and car.speed < 1 m/s',
      explain: 'the light ahead is green',
      label: 'light is green',
    },
    () => (v) => learner(v).sense.light === LIGHT_GREEN,
  ),
  numSensor(
    {
      name: 'light.distance',
      unit: 'm',
      range: [0, STOP_RANGE],
      summary: 'Meters from the front bumper to the stop line of the next light.',
      description: `It reads ${STOP_RANGE} m when no light is that close. Stopping a couple of meters short of the line is ideal.`,
      example: 'reward -0.3 when light.red and light.distance < 5 m and car.speed > 6 m/s',
      explain: 'the distance to the next stop line',
      label: 'distance to the light',
    },
    () => (v) => learner(v).sense.lightDistance,
  ),
  numSensor(
    {
      name: 'light.waited',
      unit: 's',
      range: [0, 60],
      summary: 'Seconds the SUV has stood still at this red light.',
      description: 'It counts while the SUV stands within 30 m of a red light, and starts again at the next stop line. One red lasts 22 s, so a reward for waiting that stops at 25 s pays for stopping, not for sitting through every cycle.',
      example: 'reward +0.005 when light.red and car.speed < 1 m/s and light.waited < 25 s',
      explain: 'how long the SUV has waited at this red light',
      label: 'waited at the light',
    },
    () => (v) => learner(v).redWait,
  ),
  boolSensor(
    {
      name: 'carAhead.seen',
      unit: '',
      summary: 'True while another car is ahead in the same lane.',
      description: `The car must be within ${GAP_RANGE} m and going the same way. Other cars drive from the fourth level on.`,
      example: 'reward -0.01 when carAhead.seen and carAhead.gap < 5 m',
      explain: 'a car is ahead',
      label: 'car ahead',
    },
    () => (v) => learner(v).sense.car >= 0,
  ),
  numSensor(
    {
      name: 'carAhead.gap',
      unit: 'm',
      range: [0, GAP_RANGE],
      summary: 'Bumper to bumper gap to the car ahead in the lane.',
      description: `It reads ${GAP_RANGE} m when no car is ahead. A safe gap in town is about two seconds of driving.`,
      example: 'reward -0.01 when carAhead.gap < 2 s * car.speed',
      explain: 'the gap to the car ahead',
      label: 'gap ahead',
    },
    () => (v) => learner(v).sense.gap,
  ),
  numSensor(
    {
      name: 'carAhead.closing',
      unit: 'm/s',
      range: [-20, 20],
      summary: 'How fast the gap to the car ahead is shrinking.',
      description: 'Positive while the SUV catches up and negative while the other car pulls away. It reads 0 with no car ahead.',
      example: 'reward -0.02 when carAhead.closing > 3 m/s and carAhead.gap < 15 m',
      explain: 'how fast the gap shrinks',
      label: 'closing speed',
    },
    () => (v) => {
      const s = learner(v).sense;
      return s.car >= 0 ? -s.relSpeed : 0;
    },
  ),
  boolSensor(
    {
      name: 'person.ahead',
      unit: '',
      summary: 'True while a person is in the SUV\'s path or on a crossing it will drive over.',
      description: `People on the sidewalk do not count. Only someone within ${PED_RANGE} m ahead counts, and people walk from the third level on.`,
      example: 'reward -0.02 when person.ahead and person.distance < 8 m and car.speed > 2 m/s',
      explain: 'a person is ahead',
      label: 'person ahead',
    },
    () => (v) => learner(v).sense.ped >= 0,
  ),
  numSensor(
    {
      name: 'person.distance',
      unit: 'm',
      range: [0, PED_RANGE],
      summary: 'Meters from the front bumper to the nearest person in the path.',
      description: `It reads ${PED_RANGE} m when nobody is in the path. Below about 10 m the SUV should be nearly stopped.`,
      example: 'reward -0.05 when person.distance < 6 m and car.speed > 1 m/s',
      explain: 'the distance to the person ahead',
      label: 'distance to the person',
    },
    () => (v) => learner(v).sense.pedDistance,
  ),
  numSensor(
    {
      name: 'person.offset',
      unit: 'm',
      range: [-10, 10],
      summary: 'How far to the side of the path that person is, left positive.',
      description: 'Zero means right in front of the SUV. It reads 0 when nobody is in the path.',
      example: 'reward -0.02 when person.ahead and abs(person.offset) < 1.5 m and car.speed > 3 m/s',
      explain: 'the sideways offset of the person',
      label: 'person offset',
    },
    () => (v) => learner(v).sense.pedLateral,
  ),
  numSensor(
    {
      name: 'lidar.min',
      unit: 'm',
      range: [0, 80],
      summary: 'The shortest lidar beam: how close the nearest thing around the SUV is.',
      description: 'Each beam stops at the first curb, building, car or person it meets. The beam count and range come from the brain blueprint.',
      example: 'reward -0.01 when lidar.min < 1.5 m',
      explain: 'the distance to the nearest thing',
      label: 'nearest thing',
      cost: 9,
    },
    () => (v) => {
      const beams = learner(v).lidar;
      let min = beams.length > 0 ? beams[0] : 0;
      for (let i = 1; i < beams.length; i++) if (beams[i] < min) min = beams[i];
      return min;
    },
  ),
  entry({
    name: 'lidar',
    kind: 'collection',
    scope: 'tick',
    env: 'driving',
    type: 'number',
    unit: 'm',
    summary: 'Every lidar beam, from left to right.',
    description: 'Use with for each to look at each beam in turn. Each item is the distance along that beam in meters.',
    example: 'for each d in lidar {\n  reward -0.001 when d < 2 m\n}',
    block: { category: 'sensors', label: 'each lidar beam' },
    explain: 'each lidar beam',
    binding: {
      kind: 'collection',
      maxSize: 64,
      typicalSize: 9,
      size: () => ((v) => learner(v).lidar.length) as Reader,
      item: () => (v, i) => learner(v).lidar[i],
    },
  }),
];
