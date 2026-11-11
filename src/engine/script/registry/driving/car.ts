import { SUV } from '../../../driving/car/params';
import type { RegistryEntry } from '../types';
import { boolSensor, learner, numSensor } from './sensor';

/** What the SUV knows about itself and its trip. Each read is a direct field access on the DrivingLearner. */
export const DRIVING_CAR_ENTRIES: RegistryEntry[] = [
  numSensor(
    {
      name: 'car.speed',
      unit: 'm/s',
      range: [0, SUV.topSpeed],
      summary: 'How fast the SUV is going.',
      description: 'Forward speed in meters per second. The town speed limit is 13.9 m/s, which is 50 km/h.',
      example: 'reward -0.005 when car.speed > 14 m/s',
      explain: "the SUV's speed",
      label: 'car speed',
    },
    () => (v) => learner(v).car.speed,
  ),
  numSensor(
    {
      name: 'car.noProgress',
      unit: 's',
      summary: 'Seconds stopped or lost without a good reason.',
      description: 'Counts up while the SUV gains no new ground along its route. Waiting at a red light, behind a car or for a person crossing does not count, so it is the usual way to stop a brain that parked.',
      example: 'stop "stuck" when car.noProgress > 8 s',
      explain: 'the time without progress',
      label: 'time without progress',
    },
    () => (v) => learner(v).noProgress,
  ),
  numSensor(
    {
      name: 'route.gain',
      unit: 'm',
      summary: 'New ground covered along the route this tick.',
      description: 'Meters past the furthest point the SUV had reached, so driving back and forth earns nothing. Rewarding it pays for progress toward the destination.',
      example: 'reward +0.02 * route.gain',
      explain: 'the new ground along the route',
      label: 'new ground',
      progress: true,
    },
    () => (v) => learner(v).progressGain,
  ),
  numSensor(
    {
      name: 'route.remaining',
      unit: 'm',
      summary: 'Meters left to the destination.',
      description: 'The distance along the route from the SUV to the middle of the destination zone. It goes below zero once the SUV drives past it.',
      example: 'reward +0.01 when route.remaining < 30 m',
      explain: 'the distance left to the destination',
      label: 'distance to go',
    },
    () => (v) => learner(v).remaining,
  ),
  boolSensor(
    {
      name: 'car.arrived',
      unit: '',
      summary: 'True on the tick the SUV arrives at its destination.',
      description: 'The SUV arrives when its center is in the destination zone and it is slow enough: under the speed limit on empty streets, under 8 m/s with lights, under 4 m/s with people and traffic, and stopped at rush hour. The trip ends there.',
      example: 'reward +10 when car.arrived',
      explain: 'the SUV arrives',
      label: 'arrived',
    },
    () => (v) => learner(v).arrived,
  ),
  boolSensor(
    {
      name: 'car.crashed',
      unit: '',
      summary: 'True on the tick the SUV hits another car.',
      description: 'A crash ends the trip, so the ground it never covers is already its main cost. A penalty on top makes brains steer clear sooner.',
      example: 'reward -2 when car.crashed',
      explain: 'the SUV hits a car',
      label: 'crashed',
    },
    () => (v) => learner(v).crashed,
  ),
  boolSensor(
    {
      name: 'car.hitPedestrian',
      unit: '',
      summary: 'True on the tick the SUV hits a person.',
      description: 'Hitting a person ends the trip. People walk the sidewalks from the third level on and cross at crosswalks on their walk light.',
      example: 'reward -4 when car.hitPedestrian',
      explain: 'the SUV hits a person',
      label: 'hit a person',
    },
    () => (v) => learner(v).hitPedestrian,
  ),
  boolSensor(
    {
      name: 'car.offRoad',
      unit: '',
      summary: 'True on the tick the SUV leaves the road.',
      description: 'At rush hour one wheel over the curb is enough. On the other levels only the middle of the SUV leaving the road counts, so learning brains can clip a corner. Either way it ends the trip.',
      example: 'reward -2 when car.offRoad',
      explain: 'the SUV leaves the road',
      label: 'off the road',
    },
    () => (v) => learner(v).offRoad,
  ),
  boolSensor(
    {
      name: 'car.overCurb',
      unit: '',
      summary: 'True while a wheel is over the curb.',
      description: 'Below rush hour a wheel over the curb only costs a little, so learning brains can clip a corner and still learn what a turn is. At rush hour it ends the trip.',
      example: 'reward -0.01 when car.overCurb',
      explain: 'a wheel is over the curb',
      label: 'wheel over the curb',
    },
    () => (v) => learner(v).overCurb,
  ),
];
