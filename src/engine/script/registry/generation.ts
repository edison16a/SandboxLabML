import type { GenerationContext, GenerationView } from '../generationTypes';
import { clampTo, entry, optional, param, req } from './define';
import type { MutationRates } from '../../neat/config';
import type { Effect, EffectArgs, Reader, RegistryEntry, RegistrySlice } from './types';

const view = (v: unknown) => v as GenerationView;

function counter(name: string, field: keyof GenerationContext, summary: string, description: string, example: string, explain: string): RegistryEntry {
  return entry({
    name,
    kind: 'sensor',
    scope: 'generation',
    env: 'core',
    type: 'number',
    unit: '',
    summary,
    description,
    example,
    presets: ['advanced'],
    block: { category: 'evolution', label: explain },
    explain,
    binding: { kind: 'num', read: () => (v) => view(v).ctx[field] },
  });
}

const rate = (name: string, summary: string) => optional(name, 'number', '', summary, 0, { range: [0, 1] });
const EVERY_TIER = ['beginner', 'intermediate', 'advanced'] as const;

/**
 * What the `each generation` block reads and the operators it calls. The
 * operators only fill in the NEAT plan, so a script can shape evolution but
 * the tested NEAT code still does every step.
 */
export const GENERATION_SLICE: RegistrySlice = {
  env: 'core',
  entries: [
    counter('generation', 'generation', 'Number of the generation that just finished.', 'Counts up from 0. Use it to change settings over time, such as switching tracks every 10 generations.', 'if generation > 50 {\n  select(top: 10%)\n}', 'the generation number'),
    counter('species.count', 'speciesCount', 'How many species there are right now.', 'NEAT groups similar brains into species so new ideas get time to improve. This is how many groups exist after the last generation.', 'if species.count < 4 {\n  speciate(target: 6)\n}', 'the number of species'),
    counter('best.fitness', 'bestFitness', 'Highest fitness in the last generation.', 'The score of the best agent in the generation that just finished. Compare it with mean.fitness to see how far ahead the leaders are.', 'if best.fitness > 100 {\n  select(top: 10%)\n}', 'the best fitness'),
    counter('mean.fitness', 'meanFitness', 'Average fitness of the last generation.', 'The mean score across every agent in the generation that just finished. When it climbs while best.fitness stays flat, the whole population is catching up with the leaders.', 'if mean.fitness < 1 {\n  select(top: 30%)\n}', 'the average fitness'),
    counter('stagnation', 'stagnation', 'Generations since the best fitness last improved.', 'Zero right after a new record. A high number means evolution is stuck, which is a good moment to mutate more or change the track.', 'if stagnation > 10 {\n  breed(crossover: 0.5, mutate: { weights: 0.9, addNode: 0.06 })\n}', 'generations without a new best'),
    entry({
      name: 'speciate',
      kind: 'operator',
      scope: 'generation',
      env: 'core',
      type: 'void',
      unit: '',
      params: [
        param('target', 'number', '', 'How many species to aim for.', { range: [1, 50] }),
        optional('adaptive', 'bool', '', 'Also scale structural mutation toward the target. Same switch as breed(adaptive).', false),
      ],
      summary: 'Sets how many species NEAT aims for.',
      description: 'NEAT adjusts how similar two brains must be to share a species until the count is near the target. More species keep more different ideas alive. Fewer species focus on the current best.',
      example: 'speciate(target: 8)',
      presets: EVERY_TIER,
      block: { category: 'evolution', label: 'aim for {target} species' },
      explain: 'aim for {target} species',
      binding: {
        kind: 'effect',
        apply: (args) => {
          const target = req(args.num, 'target');
          const adaptive = args.bool.get('adaptive');
          return (v, io) => {
            const plan = view(v).directives.plan;
            plan.targetSpecies = Math.round(clampTo(target(v, io), 1, 50));
            if (adaptive) plan.adaptive = adaptive(v, io);
          };
        },
      },
    }),
    entry({
      name: 'select',
      kind: 'operator',
      scope: 'generation',
      env: 'core',
      type: 'void',
      unit: '',
      params: [param('top', 'number', '', 'Share of each species allowed to have children, such as 20%.', { range: [0.01, 1] })],
      summary: 'Chooses which share of each species may become parents.',
      description: 'Only the best part of every species gets to breed. A small share pushes hard toward the current leaders, a large one keeps more variety.',
      example: 'select(top: 20%)',
      presets: EVERY_TIER,
      block: { category: 'evolution', label: 'let the top {top} breed' },
      explain: 'let the top {top} of each species breed',
      binding: {
        kind: 'effect',
        apply: (args) => {
          const top = req(args.num, 'top');
          return (v, io) => {
            view(v).directives.plan.survival = clampTo(top(v, io), 0.01, 1);
          };
        },
      },
    }),
    entry({
      name: 'breed',
      kind: 'operator',
      scope: 'generation',
      env: 'core',
      type: 'void',
      unit: '',
      params: [
        optional('crossover', 'number', '', 'Chance a child mixes two parents instead of copying one.', 0.75, { range: [0, 1] }),
        optional('mutate', 'record', '', 'Mutation chances: weights, addConnection, addNode and toggle.', 0, {
          fields: [rate('weights', 'Chance to nudge the weights.'), rate('addConnection', 'Chance to add a connection.'), rate('addNode', 'Chance to add a neuron.'), rate('toggle', 'Chance to switch a connection on or off.')],
        }),
        optional('adaptive', 'bool', '', 'Mutate structure more when there are too few species and less when there are too many.', false),
      ],
      summary: 'Sets how children are made: crossover and mutation chances.',
      description: 'Children are made by mixing two parents (crossover) and then changing them a little (mutation). Adding connections and neurons lets brains grow. Rates you leave out keep their defaults.',
      example: 'breed(crossover: 0.75, mutate: { weights: 0.8, addConnection: 0.05, addNode: 0.03 })',
      presets: EVERY_TIER,
      block: { category: 'evolution', label: 'breed with crossover {crossover} and mutation {mutate}' },
      explain: 'breed with crossover {crossover} and mutation {mutate}',
      binding: { kind: 'effect', apply: breedEffect },
    }),
    entry({
      name: 'keepChampions',
      kind: 'operator',
      scope: 'generation',
      env: 'core',
      type: 'void',
      unit: '',
      params: [optional('enabled', 'bool', '', 'Set to false to let champions be replaced.', true)],
      summary: 'Copies the best brain of each species into the next generation unchanged.',
      description: 'Without this, a lucky champion can be lost to a bad mutation. It is on by default, so call keepChampions(enabled: false) to switch it off.',
      example: 'keepChampions()',
      presets: EVERY_TIER,
      block: { category: 'evolution', label: 'keep champions' },
      explain: 'keep each species champion unchanged',
      binding: {
        kind: 'effect',
        apply: (args) => {
          const enabled = args.bool.get('enabled');
          return (v, io) => {
            view(v).directives.plan.keepChampions = enabled ? enabled(v, io) : true;
          };
        },
      },
    }),
  ],
};

/** Only the rates the script names are changed. The checker guarantees the field names are real rates. */
function breedEffect(args: EffectArgs): Effect {
  const crossover = args.num.get('crossover');
  const adaptive = args.bool.get('adaptive');
  const rates = [...(args.rec.get('mutate') ?? new Map<string, Reader>())];
  return (v, io) => {
    const plan = view(v).directives.plan;
    if (crossover) plan.crossoverRate = clampTo(crossover(v, io), 0, 1);
    if (adaptive) plan.adaptive = adaptive(v, io);
    if (rates.length > 0) {
      const mutation: MutationRates = { ...plan.mutation };
      for (const [name, r] of rates) mutation[name as keyof MutationRates] = clampTo(r(v, io), 0, 1);
      plan.mutation = mutation;
    }
  };
}
