/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import '@/workers/shared/loadScripts';
import { runTestEpisode } from './episode';
import type { TestRunRequest, TestRunResult } from './types';

/**
 * A small worker for the Studio's Test run tab. One is started per run and
 * terminated afterwards, which is also how Cancel works, so a slow script
 * never freezes the editor.
 */
const api = {
  run(req: TestRunRequest): TestRunResult {
    const result = runTestEpisode(req);
    if (!result.ok) return result;
    const { time, reward, total, speed } = result.log;
    return Comlink.transfer(result, [time.buffer, reward.buffer, total.buffer, speed.buffer] as ArrayBuffer[]);
  },
};

export type TestRunApi = typeof api;
Comlink.expose(api);
