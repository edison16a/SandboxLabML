import { suggest } from '@/engine/script/autocorrect/suggest';
import type { Header } from '@/engine/script/ast';
import { makeDiagnostic, replaceFix, suggestionFixes, type Diagnostic } from '@/engine/script/diagnostics';
import { isLabEnv } from '@/features/shell/labs';
import { studioEnvs } from '../state/studioEnvs';

/**
 * The Studio's reading of a script header against the labs it shows. The
 * engine still knows the envs of removed labs, so a script written for one
 * would check clean; here it gets an error with a fix to each lab. The
 * engine's hint for an unknown env is reworded to name only the labs.
 */
export function labEnvDiagnostics(header: Header | null, diagnostics: readonly Diagnostic[]): Diagnostic[] {
  if (!header) return [...diagnostics];
  const labs = studioEnvs().map((e) => e.env);
  const out = diagnostics.map((d) => {
    if (d.code !== 'unknown-env') return d;
    const found = suggest(header.env, labs);
    const hint = found.length > 0 ? ` Did you mean ${found[0].name}?` : ` Use ${labs.join(' or ')}.`;
    return makeDiagnostic('error', d.code, `There is no environment called ${header.env}.${hint}`, d.span, suggestionFixes(found, d.span));
  });
  const unknown = diagnostics.some((d) => d.code === 'unknown-env');
  if (!unknown && !isLabEnv(header.env)) {
    const fixes = labs.map((env) => replaceFix(`Change to ${env}`, header.envSpan, env));
    out.push(makeDiagnostic('error', 'retired-env', `This version has no ${header.env} lab. Write the script for ${labs.join(' or ')}.`, header.envSpan, fixes));
  }
  return out;
}
