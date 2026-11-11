import type { EnvId } from '../env/types';
import { DRIVING_PRESETS } from './presets/driving';
import { HIDESEEK_PRESETS } from './presets/hideseek';
import { RACING_PRESETS } from './presets/racing';
import type { ScriptPreset } from './presets/types';
import { DRIVING_SLICE } from './registry/driving';
import { HIDESEEK_SLICE } from './registry/hideseek';
import { RACING_SLICE } from './registry/racing';
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
    env: 'racing',
    slice: RACING_SLICE,
    presets: RACING_PRESETS,
    builtin: 'Checkpoints, laps and a little speed.',
    starter: [
      'script "My script" for racing v1',
      'brain racing-standard',
      '',
      'each tick {',
      '  drive(steer: brain.steer, pedal: brain.pedal)',
      '  reward +1 when checkpoint.passed',
      '  stop "crash" when car.offTrack',
      '}',
      '',
    ].join('\n'),
    templates: {
      'reward when': 'reward ${1:+1} when ${2:checkpoint.passed}',
      'reward every tick': 'reward ${1:+0.01} * ${2:car.speed}',
      'stop when': 'stop "${1:crash}" when ${2:car.offTrack}',
      'for each': 'for each ${1:r} in ${2:rays} {\n  ${3}\n}',
      sensor: 'sensor ${1:name} "${2:Label}" in ${3:0 m} .. ${4:60 m} = ${5:rays.min}',
      'each tick': 'each tick {\n  ${1:drive(steer: brain.steer, pedal: brain.pedal)}\n}',
    },
  },
  {
    env: 'hideseek',
    slice: HIDESEEK_SLICE,
    presets: HIDESEEK_PRESETS,
    builtin: 'Hiders score while unseen, seekers while they see.',
    starter: 'script "My script" for hideseek v1\n\n// Hide and Seek scripts are coming soon. Sketch your ideas here.\n',
    templates: {
      'reward when': 'reward ${1:+1} * dt when ${2:agent.hidden}',
      'reward every tick': 'reward ${1:+0.1} * dt * ${2:agent.boxesLocked}',
      'stop when': 'stop "${1:done}" when ${2:agent.timeLeft < 1 s}',
      'for each': 'for each ${1:r} in ${2:rays} {\n  ${3}\n}',
      sensor: 'sensor ${1:name} "${2:Label}" in ${3:0 m} .. ${4:12 m} = ${5:rays.min}',
      'each tick': 'each tick {\n  ${1:act(move: brain.move, turn: brain.turn, grab: brain.grab, lock: brain.lock)}\n}',
    },
  },
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
