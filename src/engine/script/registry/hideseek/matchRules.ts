import { HIDESEEK_LAYOUT_IDS } from '../../../hideseek/layouts/presets';
import type { HideSeekLayoutId } from '../../../hideseek/layouts/types';
import { MAX_PREP_SECONDS } from '../../../hideseek/trainer/directive';
import { clampTo, entry, param, req } from '../define';
import type { RegistryEntry } from '../types';
import { enabledParam, rules } from './directives';

/** Operators that set where and how the next generation's matches are played. */
export const HIDESEEK_MATCH_RULE_ENTRIES: RegistryEntry[] = [
  entry({
    name: 'prepTime',
    kind: 'operator',
    scope: 'generation',
    env: 'hideseek',
    type: 'void',
    unit: '',
    params: [param('length', 'number', 's', 'How long the seeker stays frozen and blind.', { range: [0, MAX_PREP_SECONDS] })],
    summary: 'Sets how long the prep phase lasts in the next generation.',
    description:
      'Matches always last 30 seconds, so a longer prep leaves less time to seek. A long prep early on gives new hiders time to find cover, and shrinking it later makes the game harder, which is a simple curriculum.',
    example: 'prepTime(length: 12 s)',
    presets: ['advanced'],
    block: { category: 'environment', label: 'prep phase {length}' },
    explain: 'give hiders {length} of prep',
    binding: {
      kind: 'effect',
      apply: (args) => {
        const length = req(args.num, 'length');
        return (v, io) => {
          rules(v).prepSeconds = clampTo(length(v, io), 0, MAX_PREP_SECONDS);
        };
      },
    },
  }),
  entry({
    name: 'useLayout',
    kind: 'operator',
    scope: 'generation',
    env: 'hideseek',
    type: 'void',
    unit: '',
    params: [param('id', 'string', '', 'A built-in room: open, shelter or corridor.', { choices: HIDESEEK_LAYOUT_IDS })],
    summary: 'Adds a room to the rooms the next generation plays in.',
    description:
      'Call it once for each room you want. The rounds of a generation take turns through the rooms you named. If no useLayout runs, the rooms stay as they were.',
    example: 'useLayout(id: "shelter")',
    presets: ['beginner', 'intermediate', 'advanced'],
    block: { category: 'environment', label: 'play in room {id}' },
    explain: 'play in the {id} room',
    binding: {
      kind: 'effect',
      apply: (args) => {
        const id = req(args.str, 'id') as HideSeekLayoutId;
        return (v) => {
          const d = rules(v);
          const list = d.layouts ?? [];
          if (!list.includes(id)) d.layouts = [...list, id];
        };
      },
    },
  }),
  entry({
    name: 'mixLayouts',
    kind: 'operator',
    scope: 'generation',
    env: 'hideseek',
    type: 'void',
    unit: '',
    params: [enabledParam('Set to false to play one room per round.')],
    summary: 'Mixes the rooms inside each round instead of one room per round.',
    description:
      'Every brain still meets each room equally often. Numbers measured per round, such as the share of time hidden from the scripted seeker, then stop jumping from one generation to the next with the room.',
    example: 'mixLayouts()',
    presets: ['intermediate', 'advanced'],
    block: { category: 'environment', label: 'mix rooms {enabled}' },
    explain: 'mix the rooms inside each round: {enabled}',
    binding: {
      kind: 'effect',
      apply: (args) => {
        const enabled = args.bool.get('enabled');
        return (v, io) => {
          rules(v).mixLayouts = enabled ? enabled(v, io) : true;
        };
      },
    },
  }),
  entry({
    name: 'sameStarts',
    kind: 'operator',
    scope: 'generation',
    env: 'hideseek',
    type: 'void',
    unit: '',
    params: [enabledParam('Set to false to give every match its own start.')],
    summary: 'Starts every match of a round from the same spots.',
    description:
      'Brains in the same room and round then begin from identical positions with the same box layout, so their scores differ by skill rather than by a lucky start. Starts still change every round and every generation.',
    example: 'sameStarts()',
    presets: ['intermediate'],
    block: { category: 'environment', label: 'same starts {enabled}' },
    explain: 'start every match of a round from the same spots: {enabled}',
    binding: {
      kind: 'effect',
      apply: (args) => {
        const enabled = args.bool.get('enabled');
        return (v, io) => {
          rules(v).sharedSeeds = enabled ? enabled(v, io) : true;
        };
      },
    },
  }),
];
