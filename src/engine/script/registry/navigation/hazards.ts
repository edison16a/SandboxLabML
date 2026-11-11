import { NEAR_CAP } from '../../../navigation/agent';
import type { RegistryEntry } from '../types';
import { ADVANCED, boolSensor, numSensor, runner } from './sensor';

/** What a runner touches and how close the danger is: walls and crates, spikes and moving crates. */
export const NAVIGATION_HAZARD_ENTRIES: RegistryEntry[] = [
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
  boolSensor(
    {
      name: 'agent.pushed',
      unit: '',
      summary: 'True on a tick a moving crate shoves the runner.',
      description: 'A push is not fatal on open floor, but one that pins the runner against a wall crushes it. A small penalty teaches runners to wait for the gap.',
      example: 'reward -0.01 when agent.pushed',
      explain: 'a mover pushes the runner',
      label: 'pushed',
    },
    (v) => runner(v).pushed,
  ),
  numSensor(
    {
      name: 'agent.spikeDistance',
      presets: ADVANCED,
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
