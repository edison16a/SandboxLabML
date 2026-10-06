import type { Program } from '../../script/ast';
import { compileScript } from '../../script/compiler';
import { print } from '../../script/printer';
import { findScriptPreset } from '../../script/presets/racing';
import { firstProblem, type PreparedScript } from '../prepare';
import type { CheckOutcome, LessonCheck } from '../types';

type CompilesCheck = Extract<LessonCheck, { kind: 'compiles' }>;

/** Code lines of a program printed without comments, the same text its sourceHash is taken from. */
function codeLines(program: Program): string[] {
  return print(program, { comments: false })
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '');
}

/**
 * Names the first line that differs from the preset, so a learner sees
 * what is left to change instead of a bare "not equal".
 */
function firstDifference(mine: Program, preset: Program): string {
  const a = codeLines(mine);
  const b = codeLines(preset);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if (a[i] === b[i]) continue;
    if (a[i] === undefined) return `The preset still has this line: ${b[i]}`;
    if (b[i] === undefined) return `The preset has nothing after this line: ${a[i - 1] ?? a[i]}. Remove: ${a[i]}`;
    return `You have ${a[i]} where the preset has ${b[i]}`;
  }
  return 'The scripts differ only in a way the checker cannot show';
}

/** Runs a compiles check on a script that already compiled without errors. */
export function compilesCheck(check: CompilesCheck, prepared: PreparedScript): CheckOutcome {
  if (check.noWarnings) {
    const warning = firstProblem(prepared.source, prepared.compiled.diagnostics, 'warning');
    if (warning) return { passed: false, message: `${check.message} ${warning}` };
  }
  if (check.matchesPreset) {
    const preset = findScriptPreset(check.matchesPreset);
    const target = preset ? compileScript(preset.source) : null;
    if (!target?.script) return { passed: false, message: `This step points at a preset that does not exist: ${check.matchesPreset}.` };
    if (target.script.sourceHash !== prepared.script.sourceHash) {
      return { passed: false, message: `${check.message} ${firstDifference(prepared.compiled.program, target.program)}.` };
    }
    return { passed: true, message: `Passed. Your script does exactly what the ${preset?.name} preset does.` };
  }
  return { passed: true, message: check.noWarnings ? 'Passed. The script compiles with no warnings.' : 'Passed. The script compiles.' };
}
