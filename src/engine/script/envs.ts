import type { EnvId } from '../env/types';
import { DRIVING_PRESETS } from './presets/driving';
import { NAVIGATION_PRESETS } from './presets/navigation';
import type { ScriptPreset } from './presets/types';
import { DRIVING_SLICE } from './registry/driving';
import { NAVIGATION_SLICE } from './registry/navigation';
import type { RegistrySlice } from './registry/types';

/** The script layer's part of one env: what its scripts may use and the scripts it ships. */
export interface ScriptEnv {
  env: EnvId;
  /** Sensors, actions and operators a `for <env> v1` script can name. */
  slice: RegistrySlice;
  /** Read only scripts for the picker and Studio, one per tier. */
  presets: readonly ScriptPreset[];
  /** What a run without a script trains on, in one line for the script picker. */
  builtin: string;
  /** The source a new Studio script starts from. It should compile and run as it is. */
  starter: string;
  /**
   * Snippet templates with this env's names in the blanks, by snippet
   * label ("reward when", "stop when", "each tick" and so on). The script
   * and brain lines fill in the env on their own; a label left out keeps
   * the plain template.
   */
  templates?: Readonly<Record<string, string>>;
}

/**
 * Every env a script header may name. This is the one entry a new env
 * adds to the script layer: the checker, compiler, docs, block palette,
 * autocomplete and preset lists all read it.
 */
const table: ScriptEnv[] = [
  {
    env: 'driving',
    slice: DRIVING_SLICE,
    presets: DRIVING_PRESETS,
    builtin: 'Progress, a bonus for arriving, and small costs for breaking rules.',
    starter: [
      'script "My script" for driving v1',
      'brain driving-standard',
      '',
      'each tick {',
      '  drive(steer: brain.steer, pedal: brain.pedal)',
      '  reward +0.02 * route.gain',
      '  reward +10 when car.arrived',
      '  reward -2 when rules.ranRedLight',
      '  stop "stuck" when car.noProgress > 8 s',
      '}',
      '',
    ].join('\n'),
    templates: {
      'reward when': 'reward ${1:+10} when ${2:car.arrived}',
      'reward every tick': 'reward ${1:+0.02} * ${2:route.gain}',
      'stop when': 'stop "${1:stuck}" when ${2:car.noProgress > 8 s}',
      sensor: 'sensor ${1:name} "${2:Label}" in ${3:0 m/s} .. ${4:20 m/s} = ${5:car.speed}',
      'each tick': 'each tick {\n  ${1:drive(steer: brain.steer, pedal: brain.pedal)}\n}',
    },
  },
  {
    env: 'navigation',
    slice: NAVIGATION_SLICE,
    presets: NAVIGATION_PRESETS,
    builtin: 'New ground, a finish bonus and a cost for dying.',
    starter: [
      'script "My script" for navigation v1',
      'brain navigation-starter',
      '',
      'each tick {',
      '  act(move: brain.move, turn: brain.turn)',
      '  reward +10 * agent.progressGain',
      '  reward +10 when agent.finished',
      '  reward -3 when agent.died',
      '}',
      '',
    ].join('\n'),
    templates: {
      'reward when': 'reward ${1:+10} when ${2:agent.finished}',
      'reward every tick': 'reward ${1:+10} * ${2:agent.progressGain}',
      'stop when': 'stop "${1:slow}" when ${2:agent.stuckTime > 3 s}',
      sensor: 'sensor ${1:name} "${2:Label}" in ${3:0 m} .. ${4:20 m} = ${5:agent.spikeDistance}',
      'each tick': 'each tick {\n  ${1:act(move: brain.move, turn: brain.turn)}\n}',
    },
  },
];

export const SCRIPT_ENV_TABLE: readonly ScriptEnv[] = table;

/** The env the Studio assumes for a script without a valid header, and offers first. */
export const DEFAULT_SCRIPT_ENV: EnvId = table[0].env;

export function scriptEnv(env: string): ScriptEnv | undefined {
  return table.find((e) => e.env === env);
}

const listeners: Array<() => void> = [];

/** Runs `fn` whenever a row is added or taken out, so lists derived from the table stay in step. */
export function onScriptEnvsChanged(fn: () => void): void {
  listeners.push(fn);
}

/**
 * Adds a row at run time and returns the function that takes it out.
 * Only tests use it, with registerEpisodeModule, to drive scripts and
 * lessons of a toy env; the app lists its envs in the table above.
 */
export function registerScriptEnv(row: ScriptEnv): () => void {
  table.push(row);
  for (const fn of listeners) fn();
  return () => {
    const i = table.indexOf(row);
    if (i >= 0) table.splice(i, 1);
    for (const fn of listeners) fn();
  };
}
