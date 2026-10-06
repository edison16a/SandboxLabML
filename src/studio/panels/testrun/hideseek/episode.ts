import type { HideSeekAgent } from '@/engine/hideseek/agents/agent';
import { HIDESEEK_OUTPUT_COUNT } from '@/engine/hideseek/inputConfig';
import type { HideSeekMatch } from '@/engine/hideseek/match/match';
import type { MatchResult } from '@/engine/hideseek/match/types';
import { lessonArenaPool } from '@/engine/lessons/hideseek/play';
import type { TestMatchScript } from '@/engine/lessons/hideseek/testMatch';
import { prepareScript } from '@/engine/lessons/prepare';
import { measureScriptMicros } from '../costBench';
import { MatchEvents } from './events';
import { startRequestedMatch } from './start';
import type { MatchLog, MatchTestRequest, MatchTestResult } from './types';

/** Player states kept for the cost bench: one per player every second, enough to cover prep and seek. */
const VIEW_EVERY = 30;
const MAX_VIEWS = 64;

function fail(message: string): MatchTestResult {
  return { ok: false, message };
}

/** Steps the match to the end, writing both teams' rewards and the events of every tick. */
function record(match: HideSeekMatch): { log: MatchLog; views: HideSeekAgent[] } {
  const cap = match.state.totalTicks;
  const log: MatchLog = { time: new Float32Array(cap), hiderReward: new Float32Array(cap), seekerReward: new Float32Array(cap), hiderTotal: new Float32Array(cap), seekerTotal: new Float32Array(cap), events: [] };
  const events = new MatchEvents(match.state);
  const views: HideSeekAgent[] = [];
  const [hider, seeker] = match.state.agents;
  let n = 0;
  while (!match.done && n < cap) {
    const lastHider = hider.fitness;
    const lastSeeker = seeker.fitness;
    match.step();
    log.time[n] = hider.time;
    log.hiderReward[n] = hider.fitness - lastHider;
    log.seekerReward[n] = seeker.fitness - lastSeeker;
    log.hiderTotal[n] = hider.fitness;
    log.seekerTotal[n] = seeker.fitness;
    for (const text of events.next(match.state)) log.events.push({ tick: n, text });
    if (n % VIEW_EVERY === 0 && views.length < MAX_VIEWS) for (const a of [hider, seeker]) if (a.stopReason === null) views.push(structuredClone(a));
    n++;
  }
  if (n > 0) log.events.push({ tick: n - 1, text: 'match over' });
  return { log: n === cap ? log : trim(log, n), views };
}

function trim(log: MatchLog, n: number): MatchLog {
  const t = (a: Float32Array) => a.slice(0, n);
  return { time: t(log.time), hiderReward: t(log.hiderReward), seekerReward: t(log.seekerReward), hiderTotal: t(log.hiderTotal), seekerTotal: t(log.seekerTotal), events: log.events };
}

/**
 * One Hide and Seek match of a script, logged tick by tick, plus timing.
 * It runs inside the Studio's test worker, which loads this module only
 * for Hide and Seek scripts, because it brings in the physics engine. The
 * script's own each tick block runs for both players every tick, as in
 * training. The match plays in the room the request names, with the prep
 * time the script's generation block sets for its first generation.
 */
export async function runTestMatch(req: MatchTestRequest): Promise<MatchTestResult> {
  const prepared = prepareScript(req.source);
  if (!prepared.ok) return fail(prepared.message);
  const p = prepared.value;
  if (p.env !== 'hideseek') return fail('This is a racing script. Test it with a test drive instead.');
  if (!p.blueprint) return fail('A test match needs a Hide and Seek brain, such as brain hideseek-starter.');
  const script: TestMatchScript = { script: p.script, blueprint: p.blueprint, rules: { ...p.rules, layout: req.layout } };
  const pool = await lessonArenaPool();

  const match = startRequestedMatch(script, req.brains, pool, req.seed);
  let recorded: ReturnType<typeof record>;
  let r: MatchResult;
  try {
    recorded = record(match);
    r = match.result();
  } finally {
    match.release();
  }
  const ticks = recorded.log.time.length;

  // The same request plays the same match, so a second, unlogged run times the tick cleanly.
  const again = startRequestedMatch(script, req.brains, pool, req.seed);
  let tickMicros: number;
  try {
    const t0 = performance.now();
    while (!again.done) again.step();
    tickMicros = ((performance.now() - t0) * 1000) / Math.max(1, again.tick);
  } finally {
    again.release();
  }
  const scriptMicros = measureScriptMicros(() => p.script.createController<HideSeekAgent>({ seed: req.seed }), recorded.views, HIDESEEK_OUTPUT_COUNT);
  return {
    ok: true,
    ticks,
    prepTicks: match.state.prepTicks,
    log: recorded.log,
    layout: req.layout,
    brains: req.brains,
    blueprint: p.blueprint.id,
    hiderTotal: r.hiderReward,
    seekerTotal: r.seekerReward,
    hiddenShare: r.hiddenShare,
    seenShare: r.seenShare,
    locks: r.locksPlaced,
    grabs: r.hiderGrabs + r.seekerGrabs,
    scriptMicros,
    tickMicros,
  };
}
