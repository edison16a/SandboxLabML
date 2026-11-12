import { findPresetBlueprint } from '../blueprints/presets';
import type { EpisodeBlueprint } from '../blueprints/types';
import { episodeInfo } from '../env/registry';
import { compileScript, type CompiledScript } from '../script/compiler';
import { lineOf, type Diagnostic } from '../script/diagnostics';
import { DEFAULT_SCRIPT_ENV } from '../script/envs';
import type { PreparedEpisode } from './episode/run';

export type { PreparedEpisode };

export type PrepareResult = { ok: true; value: PreparedEpisode } | { ok: false; message: string };

/** "Line 4: ..." for the first diagnostic of a severity, written for a learner. */
export function firstProblem(source: string, diagnostics: Diagnostic[], severity: Diagnostic['severity']): string | null {
  const d = diagnostics.find((x) => x.severity === severity);
  return d ? `Line ${lineOf(source, d.span.from)}: ${d.message}` : null;
}

/** The preset brain a script names, or the env's lesson brain, if it belongs to the script's env. */
function lessonBlueprint(script: CompiledScript, fallback: string): EpisodeBlueprint | null {
  const found = findPresetBlueprint(script.header.brain ?? fallback);
  return found?.env === script.header.env ? found : null;
}

/** Compiles a lesson script. Any error comes back as a learner-friendly message instead of a throw. */
export function prepareScript(source: string): PrepareResult {
  const compiled = compileScript(source);
  const script = compiled.script;
  if (!script) {
    const problem = firstProblem(source, compiled.diagnostics, 'error') ?? `The script needs a header line, such as script "My script" for ${DEFAULT_SCRIPT_ENV} v1.`;
    return { ok: false, message: `Fix this first. ${problem}` };
  }
  const env = script.header.env;
  const lessons = episodeInfo(env)?.lessons;
  if (!lessons) return { ok: false, message: 'This lab has no lessons yet.' };
  return { ok: true, value: { source, script, compiled, env, blueprint: lessonBlueprint(script, lessons.brain) } };
}
