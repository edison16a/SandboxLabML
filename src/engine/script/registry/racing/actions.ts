import type { GenerationView } from '../../generationTypes';
import { BUILT_IN_TRACKS } from '../../../racing/track/presets';
import { entry, param, req } from '../define';
import type { RegistryEntry } from '../types';
import { ALL_TIERS, numSensor } from './sensor';

const brainDocs = (side: 'steer' | 'pedal') => ({
  name: `brain.${side}`,
  unit: '' as const,
  range: [-1, 1] as const,
  presets: ALL_TIERS,
  notInSensor: true,
  category: 'actions' as const,
});

/** Brain outputs, the drive action, and the racing operators for the generation block. */
export const RACING_ACTION_ENTRIES: RegistryEntry[] = [
  numSensor(
    {
      ...brainDocs('steer'),
      summary: "The brain's steering output, from -1 (right) to 1 (left).",
      description: 'What the neural network wants to do with the steering wheel this tick. Pass it to drive so the car follows the brain, or change it first.',
      example: 'drive(steer: brain.steer, pedal: brain.pedal)',
      explain: "the brain's steering",
      label: 'brain steer',
    },
    () => (_v, io) => io.brain[0],
  ),
  numSensor(
    {
      ...brainDocs('pedal'),
      summary: "The brain's pedal output, from -1 (brake) to 1 (throttle).",
      description: 'What the neural network wants to do with the pedal this tick. Pass it to drive so the car follows the brain, or change it first.',
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
    env: 'racing',
    type: 'void',
    unit: '',
    params: [
      param('steer', 'number', '', 'Steering from -1 (full right) to 1 (full left).', { range: [-1, 1] }),
      param('pedal', 'number', '', 'Pedal from -1 (full brake) to 1 (full throttle).', { range: [-1, 1] }),
    ],
    summary: 'Sets the steering and pedal for the next step.',
    description:
      'The car applies these controls during the next physics step. Usually you pass the brain outputs straight through. If no drive runs in a tick, the car coasts with the wheel straight.',
    example: 'drive(steer: brain.steer, pedal: brain.pedal)',
    presets: ALL_TIERS,
    block: { category: 'actions', label: 'drive steer {steer} pedal {pedal}' },
    explain: 'steer by {steer} and press the pedal by {pedal}',
    binding: {
      kind: 'effect',
      apply: (args) => {
        const steer = req(args.num, 'steer');
        const pedal = req(args.num, 'pedal');
        return (v, io) => {
          io.action[0] = steer(v, io);
          io.action[1] = pedal(v, io);
        };
      },
    },
  }),
  entry({
    name: 'useTrack',
    kind: 'operator',
    scope: 'generation',
    env: 'racing',
    type: 'void',
    unit: '',
    params: [param('id', 'string', '', 'A built-in track id.', { choices: BUILT_IN_TRACKS.map((t) => t.id) })],
    summary: 'Races the next generation on a built-in track.',
    description: 'Switches the track for the generations that follow. Training on one fixed track is fastest, while switching tracks teaches brains to drive roads they have never seen.',
    example: 'useTrack(id: "oval")',
    presets: ['beginner'],
    block: { category: 'environment', label: 'use track {id}' },
    explain: 'race on the {id} track',
    binding: {
      kind: 'effect',
      apply: (args) => {
        const id = req(args.str, 'id');
        return (v) => {
          const d = (v as GenerationView).directives;
          d.racing = { ...d.racing, track: { kind: 'builtin', id } };
        };
      },
    },
  }),
  entry({
    name: 'randomTrack',
    kind: 'operator',
    scope: 'generation',
    env: 'racing',
    type: 'void',
    unit: '',
    params: [param('seed', 'number', '', 'Any whole number. The same seed always makes the same track.')],
    summary: 'Races the next generation on a random track.',
    description: 'Builds a new closed track from the seed. Random tracks stop brains from memorizing one road. Using the generation number as the seed gives a fresh track each time.',
    example: 'randomTrack(seed: generation)',
    presets: ['advanced'],
    block: { category: 'environment', label: 'random track {seed}' },
    explain: 'race on random track {seed}',
    binding: {
      kind: 'effect',
      apply: (args) => {
        const seed = req(args.num, 'seed');
        return (v, io) => {
          const d = (v as GenerationView).directives;
          const s = Math.floor(Math.abs(seed(v, io)));
          d.racing = { ...d.racing, track: { kind: 'random', seed: Number.isFinite(s) ? s >>> 0 : 0 } };
        };
      },
    },
  }),
];
