import { entry, param, req } from '../define';
import type { RegistryEntry } from '../types';
import { numSensor } from './sensor';

const brainDocs = { unit: '' as const, range: [-1, 1] as const, notInSensor: true, category: 'actions' as const };

/** The brain's two outputs and the drive action that hands them to the SUV. */
export const DRIVING_ACTION_ENTRIES: RegistryEntry[] = [
  numSensor(
    {
      ...brainDocs,
      name: 'brain.steer',
      summary: "The brain's steering output, from -1 (right) to 1 (left).",
      description: 'What the neural network wants to do with the steering wheel this tick. Pass it to drive so the SUV follows the brain, or change it first.',
      example: 'drive(steer: brain.steer, pedal: brain.pedal)',
      explain: "the brain's steering",
      label: 'brain steer',
    },
    () => (_v, io) => io.brain[0],
  ),
  numSensor(
    {
      ...brainDocs,
      name: 'brain.pedal',
      summary: "The brain's pedal output, from -1 (brake) to 1 (throttle).",
      description: 'What the neural network wants to do with the pedals this tick. Below zero brakes, above zero accelerates.',
      example: 'drive(steer: brain.steer, pedal: brain.pedal)',
      explain: "the brain's pedal",
      label: 'brain pedal',
    },
    () => (_v, io) => io.brain[1],
  ),
  entry({
    name: 'drive',
    kind: 'action',
    scope: 'tick',
    env: 'driving',
    type: 'void',
    unit: '',
    params: [
      param('steer', 'number', '', 'Steering from -1 (full right) to 1 (full left).', { range: [-1, 1] }),
      param('pedal', 'number', '', 'Pedal from -1 (full brake) to 1 (full throttle).', { range: [-1, 1] }),
    ],
    summary: 'Sets the steering and pedal for the next step.',
    description: 'The SUV applies these controls during the next physics step. Usually you pass the brain outputs straight through. If no drive runs in a tick, the SUV coasts with the wheel straight.',
    example: 'drive(steer: brain.steer, pedal: brain.pedal)',
    block: { category: 'actions', label: 'drive steer {steer} pedal {pedal}' },
    explain: 'steer by {steer} and press the pedal by {pedal}',
    binding: {
      kind: 'effect',
      apply: (args) => {
        // Passing the brain straight through is in nearly every script, so it skips the argument closures.
        if (args.names.get('steer') === 'brain.steer' && args.names.get('pedal') === 'brain.pedal') {
          return (_v, io) => {
            io.action[0] = io.brain[0];
            io.action[1] = io.brain[1];
          };
        }
        const steer = req(args.num, 'steer');
        const pedal = req(args.num, 'pedal');
        return (v, io) => {
          io.action[0] = steer(v, io);
          io.action[1] = pedal(v, io);
        };
      },
    },
  }),
];
