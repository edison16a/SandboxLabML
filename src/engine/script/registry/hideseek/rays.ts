import { entry, param } from '../define';
import type { Reader, RegistryEntry } from '../types';
import { agent, numSensor } from './sensor';

/** The sensor rays: the same distances the brain sees, read by index, all at once or the shortest. */
export const HIDESEEK_RAY_ENTRIES: RegistryEntry[] = [
  entry({
    name: 'agent.ray',
    kind: 'function',
    scope: 'tick',
    env: 'hideseek',
    type: 'number',
    unit: 'm',
    params: [param('index', 'number', '', 'Which ray: 0 points straight ahead and the count goes round to the left.')],
    summary: 'Distance to the first wall, box or player along one ray.',
    description:
      'Rays fan out all the way round the agent, starting straight ahead and turning left. How many there are depends on the brain blueprint, such as 8 for hideseek-starter and 16 for the others.',
    example: 'reward -0.1 * dt when agent.ray(0) < 0.6 m',
    block: { category: 'sensors', label: 'ray {index} distance' },
    explain: 'the distance along ray {index}',
    cost: 2,
    binding: {
      kind: 'fn',
      call: ([index]) => (v, io) => {
        const rays = agent(v).rays;
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
      summary: 'The shortest ray: distance to the closest thing around the agent.',
      description: 'The smallest distance any ray measures, in any direction. Small values mean the agent is pressed against a wall, a box or the other player.',
      example: 'reward -0.1 * dt when rays.min < 0.6 m',
      explain: 'the distance to the closest thing',
      label: 'closest thing',
      cost: 9,
    },
    (v) => {
      const rays = agent(v).rays;
      let min = rays.length > 0 ? rays[0] : 0;
      for (let i = 1; i < rays.length; i++) if (rays[i] < min) min = rays[i];
      return min;
    },
  ),
  entry({
    name: 'rays',
    kind: 'collection',
    scope: 'tick',
    env: 'hideseek',
    type: 'number',
    unit: 'm',
    summary: 'Every sensor ray, starting straight ahead and going round to the left.',
    description: 'Use with for each to look at each ray in turn. Each item is the distance along that ray in meters.',
    example: 'for each r in rays {\n  reward -0.01 * dt when r < 0.6 m\n}',
    block: { category: 'sensors', label: 'each ray' },
    explain: 'each ray',
    binding: {
      kind: 'collection',
      maxSize: 128,
      typicalSize: 16,
      size: () => ((v) => agent(v).rays.length) as Reader,
      item: () => (v, i) => agent(v).rays[i],
    },
  }),
];
