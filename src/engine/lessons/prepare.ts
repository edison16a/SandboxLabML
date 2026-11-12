import { findPresetBlueprint } from '../blueprints/presets';
import type { EpisodeBlueprint, EpisodeEnvId, RacingBlueprint } from '../blueprints/types';
import { episodeInfo } from '../env/registry';
import { Rng } from '../core/rng';
import { BUILT_IN_TRACKS } from '../racing/track/presets';
import type { TrackSpec } from '../racing/track/types';
import { compileScript, type CompileResult, type CompiledScript } from '../script/compiler';
import { lineOf, type Diagnostic } from '../script/diagnostics';
import { resolveTrackDirective } from '../training/racingSetup';
import type { PreparedEpisode } from './episode/run';

export type { PreparedEpisode };

/** Brain used when a racing script has no `brain` line, the same default a new run uses. */
export const DEFAULT_LESSON_BRAIN = 'racing-standard';

/** What every compiled lesson script has, whichever game it is for. */
interface PreparedBase {
  source: string;
  script: CompiledScript;
  compiled: CompileResult;
}

/** A racing lesson script with everything a racing check needs to run it. */
export interface PreparedRacing extends PreparedBase {
  env: 'racing';
  /** Set when the script names a preset racing brain. */
  blueprint: RacingBlueprint | null;
  /** The track the script picks for its first generation, or the Oval. */
  track: TrackSpec;
}

/**
 * A lesson script that compiled. The env field tells the games apart, so a
 * check that only makes sense for one game gets the right shape. Envs
 * added through the registry share one shape and their module's hooks.
 */
export type PreparedScript = PreparedRacing | PreparedEpisode;

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

/** The preset brain a script names, or the default, if it belongs to the script's game. */
function lessonBlueprint<E extends 'racing' | EpisodeEnvId>(script: CompiledScript, env: E, fallback: string) {
  const found = findPresetBlueprint(script.header.brain ?? fallback);
  return found?.env === env ? (found as Extract<typeof found, { env: E }>) : null;
}

/** Compiles a lesson script. Any error comes back as a learner-friendly message instead of a throw. */
export function prepareScript(source: string): PrepareResult {
  const compiled = compileScript(source);
  const script = compiled.script;
  if (!script) {
    const problem = firstProblem(source, compiled.diagnostics, 'error') ?? 'The script needs a header line, such as script "My script" for racing v1.';
    return { ok: false, message: `Fix this first. ${problem}` };
  }
  const base = { source, script, compiled };
  const env = script.header.env;
  if (env !== 'racing') {
    const lessons = episodeInfo(env)?.lessons;
    if (!lessons) return { ok: false, message: 'This lab has no lessons yet.' };
    const blueprint = lessonBlueprint(script, env, lessons.brain) as EpisodeBlueprint | null;
    return { ok: true, value: { ...base, env, blueprint } };
  }
  const blueprint = lessonBlueprint(script, 'racing', DEFAULT_LESSON_BRAIN);
  return { ok: true, value: { ...base, env: 'racing', blueprint, track: lessonTrack(script) } };
}
