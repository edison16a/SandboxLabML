/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import '@/workers/shared/loadScripts';
import { recordPreview } from '@/engine/lessons/preview/record';
import { previewBuffers, type PreviewResult } from '@/engine/lessons/preview/types';
import { runEpisodeTest, type EpisodeTestResult } from './episode/run';

/**
 * A small worker for the Studio's Test run tab and the lesson preview. The
 * tab runs each test here, and Cancel terminates the worker, so a slow
 * script never freezes the editor. The preview keeps one while it is open.
 */
const api = {
  /** One test episode of a script, driven by its env's fixed test brain. */
  async episode(source: string): Promise<EpisodeTestResult> {
    const result = await runEpisodeTest(source);
    if (!result.ok) return result;
    const { time, reward, total } = result.log;
    return Comlink.transfer(result, [time.buffer, reward.buffer, total.buffer] as ArrayBuffer[]);
  },

  /** Records the episode a lesson check runs, for the preview beside the lesson and the test run replay. */
  async preview(source: string): Promise<PreviewResult> {
    const result = await recordPreview(source);
    return result.ok ? Comlink.transfer(result, previewBuffers(result.preview)) : result;
  },
};

export type TestRunApi = typeof api;
Comlink.expose(api);
