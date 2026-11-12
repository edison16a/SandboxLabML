import { requireEpisodeInfo } from '../../env/registry';
import { prepareScript } from '../prepare';
import { recordEpisodePreview } from './episode';
import type { PreviewResult } from './types';

/**
 * Records what a lesson script does with the fixed test brain: the env's
 * test episode, the one a test run check measures. Never throws, so the
 * preview can show the reason instead of a broken canvas.
 */
export async function recordPreview(source: string): Promise<PreviewResult> {
  try {
    const prepared = prepareScript(source);
    if (!prepared.ok) return { ok: false, message: prepared.message };
    const p = prepared.value;
    if (!p.blueprint) {
      const info = requireEpisodeInfo(p.env);
      return { ok: false, message: `The preview needs a ${info.label} brain, such as brain ${info.lessons?.brain ?? `${p.env}-starter`}.` };
    }
    return { ok: true, preview: await recordEpisodePreview({ ...p, blueprint: p.blueprint }) };
  } catch (err) {
    return { ok: false, message: `The preview could not run: ${err instanceof Error ? err.message : String(err)}` };
  }
}
