import { findPresetBlueprint } from '../blueprints/presets';
import type { RacingBlueprint } from '../blueprints/types';
import { Rng } from '../core/rng';
import type { EnvId } from '../env/types';
import { BUILT_IN_TRACKS } from '../racing/track/presets';
import type { TrackSpec } from '../racing/track/types';
import { compileScript, type CompileResult, type CompiledScript } from '../script/compiler';
import { lineOf, type Diagnostic } from '../script/diagnostics';
import { resolveTrackDirective } from '../training/racingSetup';

/** Brain used when a racing script has no `brain` line, the same default a new run uses. */
export const DEFAULT_LESSON_BRAIN = 'racing-standard';

/** A lesson script that compiled, with everything a racing check needs to run it. */
export interface PreparedScript {
  source: string;
  env: EnvId;
  script: CompiledScript;
  compiled: CompileResult;
  /** Set for racing scripts that name a preset racing brain. */
  blueprint: RacingBlueprint | null;
  /** The track the script picks for its first generation, or the Oval. */
  track: TrackSpec;
}

export type PrepareResult = { ok: true; value: PreparedScript } | { ok: false; message: string };

/** "Line 4: ..." for the first diagnostic of a severity, written for a learner. */
export function firstProblem(source: string, diagnostics: Diagnostic[], severity: Diagnostic['severity']): string | null {
  const d = diagnostics.find((x) => x.severity === severity);
  return d ? `Line ${lineOf(source, d.span.from)}: ${d.message}` : null;
}

/**
 * Lessons do not carry a track of their own. A script picks one with
 * useTrack in its generation block, so a check runs that block once for
 * generation 0 and uses the track it asks for. Scripts that pick none
 * train on the Oval, the track a new run starts on.
 */
function lessonTrack(script: CompiledScript): TrackSpec {
  const oval = BUILT_IN_TRACKS[0];
  try {
    const ctx = { generation: 0, speciesCount: 1, bestFitness: 0, meanFitness: 0, stagnation: 0 };
    const directive = script.runGeneration(ctx, new Rng(1)).racing?.track;
    return directive ? resolveTrackDirective(directive, oval.width) : oval;
  } catch {
    return oval;
  }
}

/** Compiles a lesson script. Any error comes back as a learner-friendly message instead of a throw. */
export function prepareScript(source: string): PrepareResult {
  const compiled = compileScript(source);
  const script = compiled.script;
  if (!script) {
    const problem = firstProblem(source, compiled.diagnostics, 'error') ?? 'The script needs a header line, such as script "My script" for racing v1.';
    return { ok: false, message: `Fix this first. ${problem}` };
  }
  const env = script.header.env;
  if (env !== 'racing') {
    return { ok: true, value: { source, env, script, compiled, blueprint: null, track: BUILT_IN_TRACKS[0] } };
  }
  const found = findPresetBlueprint(script.header.brain ?? DEFAULT_LESSON_BRAIN);
  const blueprint = found?.env === 'racing' ? found : null;
  return { ok: true, value: { source, env, script, compiled, blueprint, track: lessonTrack(script) } };
}
