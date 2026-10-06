import { DEFAULT_CAR } from '../../../racing/car/params';
import type { RegistryEntry } from '../types';
import { ALL_TIERS, boolSensor, car, numSensor } from './sensor';

/** What a car knows about itself. Each read is a direct field access on the RacingCar. */
export const RACING_CAR_ENTRIES: RegistryEntry[] = [
  numSensor(
    {
      name: 'car.speed',
      unit: 'm/s',
      range: [0, DEFAULT_CAR.topSpeed],
      summary: 'How fast the car is going.',
      description: 'Forward speed in meters per second. The car tops out near 35 m/s. A small reward for speed teaches cars to hurry, but too much makes them crash in corners.',
      example: 'reward +0.01 * car.speed',
      explain: "the car's speed",
      label: 'car speed',
      presets: ALL_TIERS,
    },
    () => (v) => car(v).car.speed,
  ),
  numSensor(
    {
      name: 'car.steer',
      unit: 'rad',
      range: [-DEFAULT_CAR.steerMax, DEFAULT_CAR.steerMax],
      summary: 'Angle of the front wheels.',
      description: 'The angle the front wheels point at, in radians, positive to the left. The wheels turn at a limited rate and turn less at speed.',
      example: 'reward -0.01 when abs(car.steer) > 0.4 rad',
      explain: 'the front wheel angle',
      label: 'wheel angle',
    },
    () => (v) => car(v).car.steer,
  ),
  numSensor(
    {
      name: 'car.pedal',
      unit: '',
      range: [-1, 1],
      summary: 'The pedal the car used last step.',
      description: 'From -1 (full brake) to 1 (full throttle). This is the pedal the car actually applied in the step that just happened.',
      example: 'reward -0.001 when car.pedal < 0',
      explain: 'the pedal position',
      label: 'pedal',
    },
    () => (v) => car(v).car.pedal,
  ),
  boolSensor(
    {
      name: 'car.offTrack',
      unit: '',
      summary: 'True when the car is past the white edge line.',
      description:
        'Becomes true as soon as the car crosses the white line at the edge of the road. Cars that reach the barrier further out are always stopped, so this is the stricter rule for staying on the road.',
      example: 'stop "crash" when car.offTrack',
      explain: 'the car leaves the road',
      label: 'car off track',
      presets: ALL_TIERS,
      renamedFrom: ['car.offRoad'],
    },
    () => (v) => car(v).offTrack,
  ),
  numSensor(
    {
      name: 'car.noProgress',
      unit: 's',
      summary: 'Seconds since the car last moved forward along the road.',
      description: 'Resets to zero whenever the car gets further along the road than ever before. A car that parks or drives in circles keeps counting up, so it is the usual way to stop stuck cars.',
      example: 'stop "stalled" when car.noProgress > 3 s',
      explain: 'the time without progress',
      label: 'time without progress',
      presets: ALL_TIERS,
    },
    () => (v) => car(v).noProgress,
  ),
  numSensor(
    {
      name: 'car.slip',
      unit: '',
      range: [0, 1],
      summary: 'How much the tires are sliding, from 0 to 1.',
      description: 'The share of the turn the tires could not deliver because the car asked for more grip than it had. Zero means full grip. Penalizing it teaches cars to brake before corners.',
      example: 'reward -0.02 when car.slip > 0.3',
      explain: 'how much the tires slide',
      label: 'tire slip',
      presets: ['advanced'],
    },
    () => (v) => car(v).car.slip,
  ),
  numSensor(
    {
      name: 'car.lateral',
      unit: 'm',
      summary: 'Distance from the center line, positive to the left.',
      description: 'How far the car is from the middle of the road, in meters. The white line is at half the track width on either side.',
      example: 'reward -0.001 when abs(car.lateral) > 3 m',
      explain: 'the distance from the center line',
      label: 'distance from center',
    },
    () => (v) => car(v).pos.lateral,
  ),
  numSensor(
    {
      name: 'car.headingError',
      unit: 'rad',
      range: [-Math.PI, Math.PI],
      summary: 'Angle between the car and the direction of the road.',
      description: 'Zero when the car points straight along the road, positive when it points to the left of it. Write angles in deg or rad, such as 30 deg.',
      example: 'reward -0.01 when abs(car.headingError) > 30 deg',
      explain: 'the angle to the road direction',
      label: 'heading error',
    },
    () => (v) => car(v).headingError,
  ),
  numSensor(
    {
      name: 'car.time',
      unit: 's',
      summary: 'Seconds since the episode started.',
      description: 'Counts up by one tick (1/30 s) every step. Every episode also has a time limit set by the run.',
      example: 'stop "time" when car.time > 60 s',
      explain: 'the time since the start',
      label: 'time driving',
    },
    () => (v) => car(v).time,
  ),
  numSensor(
    {
      name: 'car.distance',
      unit: 'm',
      summary: 'Meters driven along the road since the start.',
      description: 'Progress along the center line. It goes down when the car drives backwards, so it measures real progress rather than distance traveled.',
      example: 'stop "done" when car.distance > 2000 m',
      explain: 'the distance driven along the road',
      label: 'distance along road',
      progress: true,
    },
    () => (v) => car(v).progress,
  ),
];
