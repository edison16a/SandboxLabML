import { requireEpisodeInfo } from '../../env/registry';
import { prepareScript, type PreparedEpisode } from '../prepare';
import { recordTestDrive } from './drive';
import { recordEpisodePreview } from './episode';
import type { PreviewResult } from './types';

/**
 * Records what a lesson script does with the fixed test brain: a test
 * drive for racing, and the env's test episode for an env added through
 * the registry. Never throws, so the
 * preview can show the reason instead of a broken canvas.
 */
export async function recordPreview(source: string): Promise<PreviewResult> {
  try {
    const prepared = prepareScript(source);
    if (!prepared.ok) return { ok: false, message: prepared.message };
    const p = prepared.value;
    if (p.env === 'racing') {
      if (!p.blueprint) return { ok: false, message: 'The preview needs a racing brain, such as brain racing-starter.' };
      return { ok: true, preview: recordTestDrive(p) };
    }
    // Racing is handled above, so this is an env added through the registry.
    const e = p as PreparedEpisode;
    if (!e.blueprint) {
      const info = requireEpisodeInfo(e.env);
      return { ok: false, message: `The preview needs a ${info.label} brain, such as brain ${info.lessons?.brain ?? `${e.env}-starter`}.` };
    }
    return { ok: true, preview: await recordEpisodePreview({ ...e, blueprint: e.blueprint }) };
  } catch (err) {
    return { ok: false, message: `The preview could not run: ${err instanceof Error ? err.message : String(err)}` };
  }
}
