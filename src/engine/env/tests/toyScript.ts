import type { ScriptEnv } from '../../script/envs';
import { entry, param, req } from '../../script/registry/define';
import { metricSensor, setEnvDirective } from '../../script/registry/envHelpers';
import type { BindContext, RegistryEntry, RegistrySlice } from '../../script/registry/types';
import type { ToyWalker } from './toyWalk';
import { TOY_ENV } from './toyEnv';

const walker = (v: unknown) => v as ToyWalker;

/** The goal from the controller context's `extra`, the way a city or a course reaches a script. */
function goalOf(ctx: BindContext): number {
  const goal = Number(ctx.controller.extra?.goal);
  if (!Number.isFinite(goal)) throw new Error('This script reads the goal, so createController needs extra.goal.');
  return goal;
}

const docs = { presets: [], summary: 'Toy.', description: 'Toy.', explain: 'toy' } as const;

/** A tick sensor of the toy slice. */
function sensor(name: string, unit: 'm' | '', read: RegistryEntry['binding']): RegistryEntry {
  return entry({ ...docs, name, kind: 'sensor', scope: 'tick', env: TOY_ENV, type: read.kind === 'bool' ? 'bool' : 'number', unit, example: `reward ${name}`, block: { category: 'sensors', label: name }, binding: read });
}

/** A generation operator that sets one key of the env requests. */
function operator(name: string, key: string): RegistryEntry {
  return entry({
    ...docs,
    name,
    kind: 'operator',
    scope: 'generation',
    env: TOY_ENV,
    type: 'void',
    unit: '',
    params: [param('value', 'number', '', 'Any number.')],
    example: `${name}(value: 2)`,
    block: { category: 'environment', label: `${name} {value}` },
    binding: {
      kind: 'effect',
      apply: (args) => {
        const value = req(args.num, 'value');
        return (v, io) => setEnvDirective(v, key, Math.round(value(v, io)));
      },
    },
  });
}

/** What a `for toy v1` script can use. Only the tests register it, through registerScriptEnv. */
export const TOY_SLICE: RegistrySlice = {
  env: TOY_ENV,
  entries: [
    sensor('walker.x', 'm', { kind: 'num', read: () => (v) => walker(v).x }),
    sensor('walker.goal', 'm', { kind: 'num', read: (ctx) => { const goal = goalOf(ctx); return () => goal; } }),
    sensor('walker.reached', '', { kind: 'bool', read: (ctx) => { const goal = goalOf(ctx); return (v) => walker(v).x >= goal; } }),
    { ...sensor('brain.move', '', { kind: 'num', read: () => (_v, io) => io.brain[0] }), notInSensor: true },
    entry({
      ...docs,
      name: 'walk',
      kind: 'action',
      scope: 'tick',
      env: TOY_ENV,
      type: 'void',
      unit: '',
      params: [param('move', 'number', '', 'Pace from -1 to 1.', { range: [-1, 1] })],
      example: 'walk(move: brain.move)',
      block: { category: 'actions', label: 'walk {move}' },
      binding: { kind: 'effect', apply: (args) => { const move = req(args.num, 'move'); return (v, io) => { io.action[0] = move(v, io); }; } },
    }),
    metricSensor({ ...docs, name: 'toy.reached', env: TOY_ENV, key: 'reachedShare', unit: '', label: 'share reached', example: 'if toy.reached > 0.5 {\n  toyLevel(value: 3)\n}' }),
    operator('toyLevel', 'level'),
    operator('toyPace', 'pace'),
  ],
  agentSeed: (v) => walker(v).seed,
};

/** The toy's row of the script env table. */
export const TOY_SCRIPT_ENV: ScriptEnv = {
  env: TOY_ENV,
  slice: TOY_SLICE,
  presets: [],
  builtin: 'New ground toward the goal.',
  starter: ['script "Walk" for toy v1', 'brain toy-basic', '', 'each tick {', '  walk(move: brain.move)', '  reward walker.x when walker.reached', '  stop "there" when walker.reached', '}', ''].join('\n'),
};
