import type { Rng } from '../core/rng';
import type { AgentController, EnvId } from '../env/types';
import { DEFAULT_NEAT, type NeatConfig } from '../neat/config';
import type { RacingCar } from '../racing/car/runtime';
import type { CustomSensorSpec } from '../racing/sensors/inputSchema';
import type { Program } from './ast';
import { check, type CheckOptions } from './checker';
import { buildController, sensorRange } from './compile/controller';
import { buildGeneration } from './compile/generation';
import { forkHash, sourceHash } from './compile/hashes';
import { estimateCost } from './cost';
import { hasErrors, sortDiagnostics, type Diagnostic } from './diagnostics';
import type { GenerationContext, GenerationDirectives } from './generationTypes';
import { lint } from './lint';
import { parse } from './parser';
import type { ControllerContext } from './registry/types';
import { formatDim } from './units';

export interface ScriptHeader {
  name: string;
  env: EnvId;
  version: number;
  brain: string | null;
}

/**
 * A checked script turned into closure trees. Nothing here evaluates
 * generated code: every closure was built from the syntax tree and bound to
 * a registry entry, so a script can only do what the registry allows.
 */
export interface CompiledScript {
  header: ScriptHeader;
  sensors: CustomSensorSpec[];
  /** Hash of the printed program without comments. */
  sourceHash: string;
  /** Hash of the brain, sensors and action mapping. A change means a fork. */
  forkHash: string;
  /** Abstract cost per agent per tick, see cost.ts. */
  costEstimate: number;
  /** Parts of the controller context this script reads. createController throws if one is missing. */
  needs: readonly 'track'[];
  /** Builds a controller for one episode batch. The view type follows the script's environment. */
  createController<V = RacingCar>(ctx: ControllerContext): AgentController<V>;
  /** Runs the `each generation` block. Operators it skips keep the defaults of `neat`. */
  runGeneration(ctx: GenerationContext, rng: Rng, neat?: NeatConfig): GenerationDirectives;
}

export interface CompileResult {
  script: CompiledScript | null;
  diagnostics: Diagnostic[];
  program: Program;
}

/**
 * Parses, checks, lints and compiles a script. Never throws on bad input:
 * any error comes back as a diagnostic and `script` is null. Warnings never
 * block compilation.
 */
export function compileScript(source: string, opts: CheckOptions = {}): CompileResult {
  const parsed = parse(source);
  const checked = check(parsed.program, opts);
  const early = [...parsed.diagnostics, ...checked.diagnostics];
  const diagnostics = sortDiagnostics(hasErrors(early) ? early : [...early, ...lint(checked)]);
  const header = parsed.program.header;
  if (hasErrors(diagnostics) || !header || !checked.env) return { script: null, diagnostics, program: parsed.program };

  const sensors: CustomSensorSpec[] = [];
  for (const item of parsed.program.items) {
    if (item.kind !== 'sensor') continue;
    const [min, max] = sensorRange(checked, item);
    const info = checked.exprs.get(item.value);
    sensors.push({ key: item.name, label: item.label, unit: info?.type.kind === 'number' ? formatDim(info.type.dim) : '', min, max });
  }
  const generation = buildGeneration(checked);
  const script: CompiledScript = {
    header: { name: header.name, env: checked.env, version: header.version, brain: parsed.program.brain?.id ?? null },
    sensors,
    sourceHash: sourceHash(parsed.program),
    forkHash: forkHash(checked),
    costEstimate: estimateCost(checked),
    needs: [...checked.needs],
    createController: <V>(ctx: ControllerContext) => buildController<V>(checked, ctx),
    runGeneration: (ctx, rng, neat = DEFAULT_NEAT) => generation(ctx, rng, neat),
  };
  return { script, diagnostics, program: parsed.program };
}

export type ChangeKind = 'none' | 'comments' | 'live' | 'fork';

/**
 * How an edit affects a running training session. `comments` means only
 * comments or layout changed. `live` means rewards, stops, lets or
 * generation operators changed and can apply from the next generation.
 * `fork` means the brain, sensors or action mapping changed, so the run
 * must branch. A script that no longer compiles is treated as a fork.
 */
export function classifyChange(oldSource: string, newSource: string): ChangeKind {
  if (oldSource === newSource) return 'none';
  const a = compileScript(oldSource);
  const b = compileScript(newSource);
  if (a.script && b.script) {
    if (a.script.sourceHash === b.script.sourceHash) return 'comments';
    return a.script.forkHash === b.script.forkHash ? 'live' : 'fork';
  }
  return sourceHash(a.program) === sourceHash(b.program) ? 'comments' : 'fork';
}
