import { loadTestEpisode, lessonsOf } from '@/engine/lessons/episode/run';
import { prepareScript, type PreparedEpisode, type PreparedScript } from '@/engine/lessons/prepare';
import { requireEpisodeInfo } from '@/engine/env/registry';

/** Per tick columns of an episode test, as typed arrays so the worker hands them over without copying. */
export interface EpisodeTickLog {
  time: Float32Array;
  reward: Float32Array;
  total: Float32Array;
  events: Array<{ tick: number; text: string }>;
}

export type EpisodeTestResult =
  | { ok: true; ticks: number; log: EpisodeTickLog; stopReason: string; totalReward: number; metrics: Array<{ label: string; value: string }>; blueprint: string; tickHz: number }
  | { ok: false; message: string };

/** True for a script of an env added through the registry. The removed built-in games carried a track or match rules instead. */
function isEpisodeScript(p: PreparedScript): p is PreparedEpisode {
  return !('track' in p) && !('rules' in p);
}

/**
 * One test episode of a script for an env added through the registry,
 * driven by the env's fixed lesson test brain: the same episode a lesson's
 * test run check measures, logged tick by tick for the Studio.
 */
export async function runEpisodeTest(source: string): Promise<EpisodeTestResult> {
  const prepared = prepareScript(source);
  if (!prepared.ok) return { ok: false, message: prepared.message };
  // The Studio flags a removed lab's header as an error first, so this only meets a script run from elsewhere.
  if (!isEpisodeScript(prepared.value)) return { ok: false, message: 'That script is for a lab this version does not have.' };
  const p = prepared.value;
  const envModule = requireEpisodeInfo(p.env);
  if (!envModule.lessons) return { ok: false, message: `${envModule.label} scripts cannot be test run yet.` };
  if (!p.blueprint) return { ok: false, message: `Test runs need a ${envModule.label} brain, such as brain ${envModule.lessons.brain}.` };
  const env = await loadTestEpisode({ ...p, blueprint: p.blueprint });
  const lessons = lessonsOf(p.env);
  const cap = Math.ceil(600 * envModule.tickHz);
  const time: number[] = [];
  const reward: number[] = [];
  const total: number[] = [];
  let last = 0;
  while (!env.done && time.length < cap) {
    env.step();
    const fitness = env.results()[0].fitness;
    time.push(env.tick / envModule.tickHz);
    reward.push(fitness - last);
    total.push(fitness);
    last = fitness;
  }
  const result = env.results()[0];
  const stopReason = result.stopReason ?? 'time';
  const measured = lessons.measure(result);
  const metrics = lessons.testRunMetrics.map((key) => ({ label: lessons.labels?.[key] ?? key, value: (lessons.formats?.[key] ?? ((v: number) => String(Math.round(v * 100) / 100)))(measured[key] ?? NaN) }));
  return {
    ok: true,
    ticks: time.length,
    log: { time: Float32Array.from(time), reward: Float32Array.from(reward), total: Float32Array.from(total), events: [{ tick: Math.max(0, time.length - 1), text: `Stopped: ${stopReason}` }] },
    stopReason,
    totalReward: result.fitness,
    metrics,
    blueprint: p.blueprint.name,
    tickHz: envModule.tickHz,
  };
}
