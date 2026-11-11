import { entry, param, req } from '../define';
import type { RegistryEntry } from '../types';
import { ALL_TIERS, numSensor } from './sensor';

const brain = (name: 'move' | 'turn', index: number, summary: string, description: string, explain: string): RegistryEntry =>
  numSensor(
    {
      name: `brain.${name}`,
      unit: '',
      range: [-1, 1],
      presets: ALL_TIERS,
      notInSensor: true,
      category: 'actions',
      summary,
      description,
      example: 'act(move: brain.move, turn: brain.turn)',
      explain,
      label: `brain ${name}`,
    },
    (_v, io) => io.brain[index],
  );

/** Brain outputs, the act action that moves the runner, and the level the runner is on. */
export const NAVIGATION_ACTION_ENTRIES: RegistryEntry[] = [
  brain(
    'move',
    0,
    "The brain's move output, from -1 (back up) to 1 (full speed ahead).",
    'What the neural network wants its legs to do this tick. Pass it to act so the runner follows the brain, or change it first.',
    "the brain's move",
  ),
  brain('turn', 1, "The brain's turn output, from -1 (right) to 1 (left).", 'How hard the neural network wants to turn this tick. A full turn spins the runner at about half a turn per second.', "the brain's turn"),
  entry({
    name: 'act',
    kind: 'action',
    scope: 'tick',
    env: 'navigation',
    type: 'void',
    unit: '',
    params: [param('move', 'number', '', 'Move from -1 (back up) to 1 (full speed ahead).', { range: [-1, 1] }), param('turn', 'number', '', 'Turn from -1 (right) to 1 (left).', { range: [-1, 1] })],
    summary: 'Sets how the runner moves and turns in the next step.',
    description: 'The runner applies these controls during the next step. Usually you pass the brain outputs straight through. If no act runs in a tick, the runner stands still.',
    example: 'act(move: brain.move, turn: brain.turn)',
    presets: ALL_TIERS,
    block: { category: 'actions', label: 'act move {move} turn {turn}' },
    explain: 'move by {move} and turn by {turn}',
    binding: {
      kind: 'effect',
      apply: (args) => {
        // Passing the brain straight through is in nearly every script, so it copies the outputs directly.
        if (args.names.get('move') === 'brain.move' && args.names.get('turn') === 'brain.turn') {
          return (_v, io) => {
            io.action[0] = io.brain[0];
            io.action[1] = io.brain[1];
          };
        }
        const move = req(args.num, 'move');
        const turn = req(args.num, 'turn');
        return (v, io) => {
          io.action[0] = move(v, io);
          io.action[1] = turn(v, io);
        };
      },
    },
  }),
  entry({
    name: 'agent.level',
    kind: 'sensor',
    scope: 'tick',
    env: 'navigation',
    type: 'number',
    unit: '',
    range: [0, 6],
    summary: 'The curriculum level of the course the runner is on, from 0 to 6.',
    description: 'Level 0 is an empty room and every level after it adds one kind of obstacle. Use it to change a reward as the courses get harder.',
    example: 'reward -1 when agent.died and agent.level < 3',
    block: { category: 'sensors', label: 'level' },
    explain: 'the level',
    binding: {
      kind: 'num',
      read: (ctx) => {
        // The level is fixed for an episode, so it is read once when the controller is built.
        const level = Number(ctx.controller.extra?.level ?? 0);
        const value = Number.isFinite(level) ? level : 0;
        return () => value;
      },
    },
  }),
];
