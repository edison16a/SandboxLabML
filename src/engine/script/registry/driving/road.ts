import { SUV } from '../../../driving/car/params';
import { LANE_WIDTH } from '../../../driving/city/dimensions';
import type { DrivingLevel } from '../../../driving/levels';
import type { Route } from '../../../driving/route/route';
import type { BindContext, RegistryEntry } from '../types';
import { boolSensor, learner, numSensor } from './sensor';

/** The trip's route from the controller context. Training always sets it; a bare checker context falls back to null. */
function routeOf(ctx: BindContext): Route | null {
  return (ctx.controller.extra?.route as Route | undefined) ?? null;
}

function levelOf(ctx: BindContext): DrivingLevel | null {
  return (ctx.controller.extra?.level as DrivingLevel | undefined) ?? null;
}

/** Where the SUV is on the road and on its trip: lane, speed limit, the next turn and the trip itself. */
export const DRIVING_ROAD_ENTRIES: RegistryEntry[] = [
  numSensor(
    {
      name: 'lane.offset',
      unit: 'm',
      range: [-2 * LANE_WIDTH, 2 * LANE_WIDTH],
      summary: 'How far the SUV is from the middle of its lane, left positive.',
      description: 'Zero in the middle of the lane. A lane is 3.5 m wide, so past about 1 m the body crosses a lane line.',
      example: 'reward -0.001 * abs(lane.offset / 1 m)',
      explain: 'the distance from the middle of the lane',
      label: 'lane offset',
    },
    () => (v) => learner(v).lateral,
  ),
  numSensor(
    {
      name: 'lane.headingError',
      unit: 'rad',
      range: [-Math.PI, Math.PI],
      summary: 'The angle between where the SUV points and where its lane runs, left positive.',
      description: 'Zero when the SUV points straight down its lane. Large values mean it is about to leave the lane or is turning.',
      example: 'reward -0.001 when abs(lane.headingError) > 30 deg',
      explain: 'the angle to the lane',
      label: 'heading error',
    },
    () => (v) => learner(v).headingError,
  ),
  numSensor(
    {
      name: 'road.speedLimit',
      unit: 'm/s',
      range: [0, SUV.topSpeed],
      summary: 'The speed limit where the SUV is.',
      description: 'It is 13.9 m/s (50 km/h) in town and 8.3 m/s (30 km/h) in the slow zones. A slow zone covers a whole street, so the limit only changes at a junction.',
      example: 'reward -0.01 when car.speed > road.speedLimit',
      explain: 'the speed limit',
      label: 'speed limit',
    },
    () => (v) => learner(v).speedLimit,
  ),
  numSensor(
    {
      name: 'route.nextTurn',
      unit: '',
      range: [-1, 1],
      summary: 'The next move on the route: -1 for a left turn, 0 for straight on, 1 for a right turn.',
      description: 'It reads 0 too once the last turn is behind the SUV. Pair it with route.turnDistance to know how soon it comes.',
      example: 'reward -0.01 when route.nextTurn != 0 and route.turnDistance < 20 m and car.speed > 8 m/s',
      explain: 'the next turn',
      label: 'next turn',
    },
    () => (v) => learner(v).nextTurn,
  ),
  numSensor(
    {
      name: 'route.turnDistance',
      unit: 'm',
      range: [0, 500],
      summary: 'Meters from the front bumper to where the next move starts.',
      description: 'The move starts at the stop line of its junction. It reads 0 while the SUV is turning.',
      example: 'reward -0.01 when route.turnDistance < 15 m and car.speed > 9 m/s',
      explain: 'the distance to the next turn',
      label: 'distance to the turn',
    },
    () => (v) => learner(v).turnDistance,
  ),
  numSensor(
    {
      name: 'route.completion',
      unit: '',
      range: [0, 1],
      summary: 'The share of the trip covered so far, from 0 to 1.',
      description: 'It counts the furthest point reached, so it never goes down. It is 1 at the middle of the destination zone.',
      example: 'reward +1 when car.arrived and route.completion > 90%',
      explain: 'the share of the trip covered',
      label: 'trip covered',
    },
    (ctx) => {
      const route = routeOf(ctx);
      if (!route) return () => 0;
      const length = Math.max(1, route.destS - route.startS);
      return (v) => Math.min(1, Math.max(0, (learner(v).maxProgress - route.startS) / length));
    },
  ),
  numSensor(
    {
      name: 'trip.length',
      unit: 'm',
      range: [0, 2000],
      summary: 'How long this trip is, start to destination.',
      description: 'Each generation drives new trips, so it changes from one to the next. Dividing by it turns meters into a share of the trip.',
      example: 'reward +2 * route.gain / trip.length',
      explain: 'the length of the trip',
      label: 'trip length',
    },
    (ctx) => {
      const route = routeOf(ctx);
      const length = route ? route.destS - route.startS : 0;
      return () => length;
    },
  ),
  numSensor(
    {
      name: 'trip.level',
      unit: '',
      range: [1, 5],
      summary: 'The level this trip is driven at, from 1 (empty streets) to 5 (rush hour).',
      description: 'It is the same for every SUV in a generation. Use it to ask more of brains as the curriculum climbs.',
      example: 'reward -0.05 when trip.level >= 3 and rules.speeding',
      explain: 'the level',
      label: 'level',
    },
    (ctx) => {
      const id = levelOf(ctx)?.id ?? 1;
      return () => id;
    },
  ),
  numSensor(
    {
      name: 'car.time',
      unit: 's',
      range: [0, 600],
      summary: 'Seconds since this trip started.',
      description: 'It counts every tick the SUV drives, waiting included. Paying less for a late arrival rewards quicker trips.',
      example: 'reward +10 - 0.05 * car.time / 1 s when car.arrived',
      explain: 'the time on this trip',
      label: 'time on the trip',
    },
    () => (v) => learner(v).time,
  ),
  boolSensor(
    {
      name: 'car.waiting',
      unit: '',
      summary: 'True while the SUV stands still for a good reason.',
      description: 'A red or yellow light close ahead, a car close in front or a person in the path all count. It is why waiting never counts toward car.noProgress.',
      example: 'reward +0.002 when car.waiting',
      explain: 'the SUV is waiting',
      label: 'waiting',
    },
    () => (v) => learner(v).waiting,
  ),
  boolSensor(
    {
      name: 'car.hardBrake',
      unit: '',
      summary: 'True on a tick the SUV brakes hard.',
      description: 'Hard braking is uncomfortable and often means the brain saw a light or a person too late. A small cost teaches it to slow down sooner.',
      example: 'reward -0.02 when car.hardBrake',
      explain: 'the SUV brakes hard',
      label: 'hard braking',
    },
    () => (v) => learner(v).hardBrake,
  ),
];
