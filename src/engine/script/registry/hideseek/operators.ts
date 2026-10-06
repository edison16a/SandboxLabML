import { MAX_HALL_OF_FAME } from '../../../hideseek/trainer/directive';
import type { TickIO } from '../../../env/types';
import { clampTo, entry, optional, param, req } from '../define';
import type { RegistryEntry } from '../types';
import { rules } from './directives';

const rounds = (name: string, summary: string) => optional(name, 'number', '', summary, 0, { range: [0, 6] });

/**
 * Operators that choose who each brain plays in the next generation. Like
 * every Hide and Seek operator they only write `directives.hideseek`; the
 * trainer checks the values again and applies them, so a script can change
 * the schedule but never break it.
 */
export const HIDESEEK_OPPONENT_ENTRIES: RegistryEntry[] = [
  entry({
    name: 'opponents',
    kind: 'operator',
    scope: 'generation',
    env: 'hideseek',
    type: 'void',
    unit: '',
    params: [
      rounds('current', "Rounds against the other team's current brains."),
      rounds('hallOfFame', 'Rounds against past champions of the other team.'),
      rounds('scripted', 'Rounds against the hand-written scripted seeker and scripted hider.'),
    ],
    summary: 'Chooses who each brain plays in the next generation.',
    description:
      'Every round gives each brain one scored match. Current opponents keep the arms race going, past champions stop a team from forgetting old tricks, and the scripted agents are a fixed sparring partner while the other team is still clumsy. Kinds you leave out get no rounds, and the total must be between 1 and 6.',
    example: 'opponents(current: 2, hallOfFame: 2)',
    presets: ['intermediate', 'advanced'],
    block: { category: 'environment', label: 'play {current} current, {hallOfFame} hall of fame and {scripted} scripted rounds' },
    explain: 'play {current} rounds against current opponents, {hallOfFame} against past champions and {scripted} against the scripted agents',
    binding: {
      kind: 'effect',
      apply: (args) => {
        const count = (k: string) => {
          const r = args.num.get(k);
          return r ? (v: unknown, io: TickIO) => Math.round(clampTo(r(v, io), 0, 6)) : () => 0;
        };
        const current = count('current');
        const hallOfFame = count('hallOfFame');
        const scripted = count('scripted');
        return (v, io) => {
          rules(v).opponents = { current: current(v, io), hallOfFame: hallOfFame(v, io), scripted: scripted(v, io) };
        };
      },
    },
  }),
  entry({
    name: 'hallOfFame',
    kind: 'operator',
    scope: 'generation',
    env: 'hideseek',
    type: 'void',
    unit: '',
    params: [param('size', 'number', '', 'How many past champions each team keeps.', { range: [1, MAX_HALL_OF_FAME] })],
    summary: 'Sets how many past champions each team keeps as opponents.',
    description:
      'After every generation the best brain of each team joins its hall of fame, and the oldest leave once it is full. A small hall keeps opponents recent, a large one keeps old strategies around for longer.',
    example: 'hallOfFame(size: 20)',
    presets: ['intermediate', 'advanced'],
    block: { category: 'environment', label: 'keep {size} past champions' },
    explain: 'keep {size} past champions per team',
    binding: {
      kind: 'effect',
      apply: (args) => {
        const size = req(args.num, 'size');
        return (v, io) => {
          rules(v).hallOfFameSize = Math.round(clampTo(size(v, io), 1, MAX_HALL_OF_FAME));
        };
      },
    },
  }),
];
