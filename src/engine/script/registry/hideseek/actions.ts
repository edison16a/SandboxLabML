import { entry, param, req } from '../define';
import type { RegistryEntry } from '../types';
import { ALL_TIERS, numSensor, type SensorDocs } from './sensor';

const OUTPUTS = ['move', 'turn', 'grab', 'lock'] as const;
type Output = (typeof OUTPUTS)[number];

const DOCS: Record<Output, Pick<SensorDocs, 'summary' | 'description' | 'explain' | 'label'>> = {
  move: {
    summary: "The brain's move output, from -1 (back up) to 1 (full speed ahead).",
    description: 'What the neural network wants to do with its legs this tick. Pass it to act so the agent follows the brain, or change it first.',
    explain: "the brain's move",
    label: 'brain move',
  },
  turn: {
    summary: "The brain's turn output, from -1 (right) to 1 (left).",
    description: 'How hard the neural network wants to turn this tick. Full turn spins the agent at about half a turn per second.',
    explain: "the brain's turn",
    label: 'brain turn',
  },
  grab: {
    summary: "The brain's grab output: above 0 means hold a box.",
    description: 'While it stays above 0 the agent picks up the nearest free box in front of it and carries it. Letting it fall to 0 or below drops the box.',
    explain: "the brain's grab",
    label: 'brain grab',
  },
  lock: {
    summary: "The brain's lock output: rising above 0 locks or unlocks a box.",
    description: 'Each time it rises above 0, the agent locks the free box in front of it, or unlocks one its own team locked. Both teams lock, but not while carrying a box or on a ramp.',
    explain: "the brain's lock",
    label: 'brain lock',
  },
};

/** One brain output, read straight from the brain's output array. */
function brainOutput(name: Output, index: number): RegistryEntry {
  return numSensor(
    {
      ...DOCS[name],
      name: `brain.${name}`,
      unit: '',
      range: [-1, 1],
      presets: ALL_TIERS,
      notInSensor: true,
      category: 'actions',
      example: 'act(move: brain.move, turn: brain.turn, grab: brain.grab, lock: brain.lock)',
    },
    (_v, io) => io.brain[index],
  );
}

const control = (name: Output, summary: string) => param(name, 'number', '', summary, { range: [-1, 1] });

/** Brain outputs and the act action that turns them into movement. */
export const HIDESEEK_ACTION_ENTRIES: RegistryEntry[] = [
  ...OUTPUTS.map(brainOutput),
  entry({
    name: 'act',
    kind: 'action',
    scope: 'tick',
    env: 'hideseek',
    type: 'void',
    unit: '',
    params: [
      control('move', 'Move from -1 (back up) to 1 (full speed ahead).'),
      control('turn', 'Turn from -1 (right) to 1 (left).'),
      control('grab', 'Above 0 holds a box, 0 or below drops it.'),
      control('lock', 'Rising above 0 locks or unlocks the box in front.'),
    ],
    summary: 'Sets how the agent moves, turns, grabs and locks in the next step.',
    description:
      'The agent applies these controls during the next physics step. Usually you pass the four brain outputs straight through. If no act runs in a tick, the agent stands still and lets go of any box.',
    example: 'act(move: brain.move, turn: brain.turn, grab: brain.grab, lock: brain.lock)',
    presets: ALL_TIERS,
    block: { category: 'actions', label: 'act move {move} turn {turn} grab {grab} lock {lock}' },
    explain: 'move by {move}, turn by {turn}, grab with {grab} and lock with {lock}',
    binding: {
      kind: 'effect',
      apply: (args) => {
        // Passing the brain straight through is in nearly every script, so it copies the outputs directly.
        if (OUTPUTS.every((o) => args.names.get(o) === `brain.${o}`)) {
          return (_v, io) => {
            for (let k = 0; k < 4; k++) io.action[k] = io.brain[k];
          };
        }
        const readers = OUTPUTS.map((o) => req(args.num, o));
        return (v, io) => {
          for (let k = 0; k < 4; k++) io.action[k] = readers[k](v, io);
        };
      },
    },
  }),
];
