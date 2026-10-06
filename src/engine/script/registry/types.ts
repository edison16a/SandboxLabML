import type { Rng } from '../../core/rng';
import type { EnvId, TickIO } from '../../env/types';
import type { Track } from '../../racing/track/types';
import type { UnitName } from '../units';

/** Where a name may be used: once per agent per tick, once per generation, or both. */
export type Scope = 'tick' | 'generation' | 'both';
export type SliceEnv = 'core' | EnvId;
export type EntryKind = 'sensor' | 'function' | 'action' | 'operator' | 'collection' | 'constant';
export type PresetTier = 'beginner' | 'intermediate' | 'advanced';
export type BlockCategory = 'sensors' | 'actions' | 'rewards' | 'logic' | 'math' | 'evolution' | 'environment';
export type ParamType = 'number' | 'bool' | 'string' | 'record';

/**
 * `*` accepts any unit, as long as every `*` parameter of the call agrees,
 * which is how `min(a, b)` works on meters and seconds alike. A result of
 * `sqrt` means half the unit of the `*` parameters.
 */
export type UnitSpec = UnitName | '*';
export type ResultUnit = UnitSpec | 'sqrt';

export interface ParamDef {
  name: string;
  type: ParamType;
  unit: UnitSpec;
  required: boolean;
  default?: number | boolean | string;
  /** Inclusive bounds. Constant arguments outside them get a warning and are clamped. */
  range?: readonly [number, number];
  /** Allowed values of a string parameter, such as built-in track ids. */
  choices?: readonly string[];
  /** Fields of a record parameter, such as the rates inside `mutate: { ... }`. */
  fields?: readonly ParamDef[];
  summary: string;
}

/** Compiled closures. Views are `unknown` here and cast by each environment slice. */
export type Reader = (view: unknown, io: TickIO) => number;
export type Test = (view: unknown, io: TickIO) => boolean;
export type Effect = (view: unknown, io: TickIO) => void;
export type ItemReader = (view: unknown, index: number) => number;

/** Passed to `createController`. The trainer builds one per episode batch. */
export interface ControllerContext {
  seed: number;
  /** Required by racing scripts that read the track, such as track.width. */
  track?: Track;
  /** Room for what later environments need, so adding one does not change this type. */
  extra?: Readonly<Record<string, unknown>>;
}

/** Lets `rand()` follow whichever Rng is current: per agent in a tick, the coordinator's in a generation. */
export interface RngHolder {
  rng: Rng;
}

export interface BindContext {
  controller: ControllerContext;
  rng: RngHolder;
}

/** Compiled arguments of an action or operator call, by parameter name. Only arguments that were given appear. */
export interface EffectArgs {
  num: ReadonlyMap<string, Reader>;
  bool: ReadonlyMap<string, Test>;
  str: ReadonlyMap<string, string>;
  rec: ReadonlyMap<string, ReadonlyMap<string, Reader>>;
  /** Arguments written as a plain name, such as steer to "brain.steer", so a binding can take a faster path. */
  names: ReadonlyMap<string, string>;
}

/**
 * How an entry runs. Each binding is a factory that returns a closure for
 * one call site, so the compiled tree calls straight into a field read like
 * `rc.car.speed` instead of going through a shared dispatcher.
 */
export type Binding =
  | { kind: 'num'; read: (ctx: BindContext) => Reader }
  | { kind: 'bool'; read: (ctx: BindContext) => Test }
  | { kind: 'const'; value: number }
  | { kind: 'fn'; call: (args: Reader[], ctx: BindContext) => Reader; fold?: (args: number[]) => number }
  | { kind: 'effect'; apply: (args: EffectArgs, ctx: BindContext) => Effect }
  | { kind: 'collection'; maxSize: number; typicalSize: number; size: (ctx: BindContext) => Reader; item: (ctx: BindContext) => ItemReader };

export interface RegistryEntry {
  /** Dotted name as written in scripts, such as `car.speed`. */
  name: string;
  kind: EntryKind;
  scope: Scope;
  env: SliceEnv;
  type: 'number' | 'bool' | 'void';
  unit: ResultUnit;
  /** Known bounds of a sensor's value. Used by lint to spot stop rules that can never fire. */
  range?: readonly [number, number];
  params: readonly ParamDef[];
  summary: string;
  description: string;
  /** SBL that compiles inside a block of this entry's scope. */
  example: string;
  presets: readonly PresetTier[];
  block: { category: BlockCategory; label: string };
  /** Phrase for the Explain toggle, with `{param}` holes for arguments. */
  explain: string;
  /** Old names that scripts may still use. The checker rewrites them to `name`. */
  renamedFrom?: readonly string[];
  /** Relative cost of one evaluation, for the per tick cost estimate. */
  cost: number;
  /** Rewarding this counts as rewarding progress, for the lint that looks for one. */
  progress?: boolean;
  /** Not known yet when script sensors run, so sensor expressions may not read it. */
  notInSensor?: boolean;
  /** Pieces of the controller context this entry needs. */
  needs?: readonly 'track'[];
  binding: Binding;
}

/** One environment's part of the registry. */
export interface RegistrySlice {
  env: SliceEnv;
  entries: readonly RegistryEntry[];
  /**
   * Stable per-agent seed for `rand()` in tick scope. It must not depend on
   * the agent's position in the batch, so a ghost replayed alone draws the
   * same numbers it drew in training.
   */
  agentSeed?: (view: unknown) => number;
}
