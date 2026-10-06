import { curvatureAhead } from '../../../racing/track/buildTrack';
import { entry, param } from '../define';
import type { Reader, RegistryEntry } from '../types';
import { car, numSensor, trackOf } from './sensor';

/** The road and the distance rays. Track entries need the Track passed to createController. */
export const RACING_TRACK_ENTRIES: RegistryEntry[] = [
  numSensor(
    {
      name: 'track.width',
      unit: 'm',
      summary: 'Width of the road between the white lines.',
      description: 'The full width of the road in meters. Half of it on either side of the center line is still on the road.',
      example: 'reward -0.01 when abs(car.lateral) > track.width / 4',
      explain: 'the road width',
      label: 'road width',
      needs: ['track'],
    },
    (ctx) => {
      const width = trackOf(ctx).halfWidth * 2;
      return () => width;
    },
  ),
  entry({
    name: 'track.curvatureAhead',
    kind: 'function',
    scope: 'tick',
    env: 'racing',
    type: 'number',
    unit: '1/m',
    params: [param('distance', 'number', 'm', 'How far down the road to look.', { range: [0, 200] })],
    summary: 'How sharply the road bends some distance ahead.',
    description:
      'Curvature is one over the radius of the bend, positive when the road turns left. A bend with a 20 m radius gives 0.05 1/m and a straight gives 0. Looking ahead lets a brain brake before the corner arrives.',
    example: 'reward -0.01 * car.speed * abs(track.curvatureAhead(distance: 20 m))',
    presets: ['advanced'],
    block: { category: 'sensors', label: 'road bend {distance} ahead' },
    explain: 'how sharply the road bends {distance} ahead',
    needs: ['track'],
    cost: 2,
    binding: {
      kind: 'fn',
      call: ([distance], ctx) => {
        const track = trackOf(ctx);
        return (v, io) => {
          const d = distance(v, io);
          return curvatureAhead(track, car(v).pos.index, d > 0 ? d : 0);
        };
      },
    },
  }),
  entry({
    name: 'car.ray',
    kind: 'function',
    scope: 'tick',
    env: 'racing',
    type: 'number',
    unit: 'm',
    params: [param('index', 'number', '', 'Which ray, counting from 0 on the far left.')],
    summary: 'Distance to the barrier along one ray.',
    description: 'Rays fan out from the car, from the far left (index 0) to the far right. Each one measures the distance to the nearest edge of the road, up to the ray range.',
    example: 'reward -0.01 when car.ray(0) < 2 m',
    block: { category: 'sensors', label: 'ray {index} distance' },
    explain: 'the distance along ray {index}',
    cost: 2,
    binding: {
      kind: 'fn',
      call: ([index]) => (v, io) => {
        const rays = car(v).rays;
        if (rays.length === 0) return 0;
        const k = index(v, io);
        return rays[k >= 0 ? Math.min(rays.length - 1, Math.floor(k)) : 0];
      },
    },
  }),
  numSensor(
    {
      name: 'rays.min',
      unit: 'm',
      summary: 'The shortest ray: distance to the closest edge in view.',
      description: 'The smallest distance any ray measures. Small values mean the car is about to touch the edge of the road.',
      example: 'reward -0.02 when rays.min < 1 m',
      explain: 'the distance to the closest edge',
      label: 'closest edge',
      cost: 9,
    },
    () => (v) => {
      const rays = car(v).rays;
      let min = rays.length > 0 ? rays[0] : 0;
      for (let i = 1; i < rays.length; i++) if (rays[i] < min) min = rays[i];
      return min;
    },
  ),
  entry({
    name: 'rays',
    kind: 'collection',
    scope: 'tick',
    env: 'racing',
    type: 'number',
    unit: 'm',
    summary: 'Every distance ray, from left to right.',
    description: 'Use with for each to look at each ray in turn. Each item is the distance along that ray in meters. How many rays there are depends on the brain blueprint.',
    example: 'for each r in rays {\n  reward -0.001 when r < 3 m\n}',
    block: { category: 'sensors', label: 'each ray' },
    explain: 'each ray',
    binding: {
      kind: 'collection',
      maxSize: 128,
      typicalSize: 9,
      size: () => ((v) => car(v).rays.length) as Reader,
      item: () => (v, i) => car(v).rays[i],
    },
  }),
];
