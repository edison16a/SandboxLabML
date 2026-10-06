import { prepareScript } from '../prepare';
import { recordTestDrive } from './drive';
import type { PreviewResult } from './types';

/** The match recorder brings in the Rapier physics engine, so it loads the first time a Hide and Seek script is previewed. */
const matchRecorder = () => import('./match');

/**
 * Records what a lesson script does with the fixed test brain: a test
 * drive for racing, a test match for Hide and Seek. Never throws, so the
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
    if (!p.blueprint) return { ok: false, message: 'The preview needs a Hide and Seek brain, such as brain hideseek-starter.' };
    return { ok: true, preview: await (await matchRecorder()).recordTestMatch(p) };
  } catch (err) {
    return { ok: false, message: `The preview could not run: ${err instanceof Error ? err.message : String(err)}` };
  }
}
