/// <reference lib="webworker" />
import * as Comlink from 'comlink';
import '@/workers/shared/loadScripts';
import { runTestEpisode } from './episode';
import type { MatchTestRequest, MatchTestResult } from './hideseek/types';
import type { TestRunRequest, TestRunResult } from './types';

/**
 * A small worker for the Studio's Test run tab. One is started per run and
 * terminated afterwards, which is also how Cancel works, so a slow script
 * never freezes the editor. Hide and Seek code loads on its first match,
 * since it brings the Rapier physics engine and a racing run never needs it.
 */
const api = {
  run(req: TestRunRequest): TestRunResult {
    const result = runTestEpisode(req);
    if (!result.ok) return result;
    const { time, reward, total, speed } = result.log;
    return Comlink.transfer(result, [time.buffer, reward.buffer, total.buffer, speed.buffer] as ArrayBuffer[]);
  },

  async match(req: MatchTestRequest): Promise<MatchTestResult> {
    const { runTestMatch } = await import('./hideseek/episode');
    const result = await runTestMatch(req);
    if (!result.ok) return result;
    const { time, hiderReward, seekerReward, hiderTotal, seekerTotal } = result.log;
    return Comlink.transfer(result, [time.buffer, hiderReward.buffer, seekerReward.buffer, hiderTotal.buffer, seekerTotal.buffer] as ArrayBuffer[]);
  },
};

export type TestRunApi = typeof api;
Comlink.expose(api);
