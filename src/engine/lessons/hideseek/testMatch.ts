import { blueprintShape } from '../../blueprints/shape';
import type { HideSeekAgent } from '../../hideseek/agents/agent';
import type { HideSeekMatch } from '../../hideseek/match/match';
import { startMatch } from '../../hideseek/match/runMatch';
import type { MatchSpec } from '../../hideseek/match/types';
import type { ArenaPool } from '../../hideseek/world/pool';
import { Population } from '../../neat/population';
import type { PreparedHideSeek } from '../prepare';
import type { TestMatchMetrics } from './metrics';
import { lessonArenaPool, playMatch } from './play';
import { TEST_MATCH_SEED } from './rules';
import { TestHider, testSeekerBrain, withTestBrain } from './testPlayers';

/** Seed of the stand-in genomes. Their outputs are replaced by the test players, so only their shape matters. */
const TEST_GENOME_SEED = 0x7e57;

/** What a test match needs from a prepared script. The Studio fills in its own room, so it is not a whole PreparedHideSeek. */
export type TestMatchScript = Pick<PreparedHideSeek, 'script' | 'blueprint' | 'rules'>;

/** Adds up how far each player walks, tick by tick. */
function odometer(agents: readonly HideSeekAgent[]): { step: () => void; meters: number[] } {
  const last = agents.map((a) => ({ x: a.x, z: a.z }));
  const meters = agents.map(() => 0);
  const step = () =>
    agents.forEach((a, i) => {
      meters[i] += Math.hypot(a.x - last[i].x, a.z - last[i].z);
      last[i].x = a.x;
      last[i].z = a.z;
    });
  return { step, meters };
}

/**
 * Sets up the test match on a pooled world, ready to step: the two fixed
 * test players (see testPlayers.ts) in the script's room, with the
 * script's own each tick block running for both. Lesson checks, the
 * lesson preview and the Studio's test run all start here, so they play
 * the same match. Call `release()` on it when done.
 */
export function startTestMatch(prepared: TestMatchScript, pool: ArenaPool, seed = TEST_MATCH_SEED): HideSeekMatch {
  const blueprint = prepared.blueprint;
  if (!blueprint) throw new Error('Test matches need a Hide and Seek brain.');
  const { script, rules } = prepared;
  const genome = Population.create(blueprintShape(blueprint, script.sensors.length), TEST_GENOME_SEED, { populationSize: 1 }).genomes[0];
  const team = { genome, inputs: blueprint.inputs };
  const spec: MatchSpec = { layout: rules.layout, seed, hider: team, seeker: team };
  if (rules.prepSeconds !== undefined) spec.prepSeconds = rules.prepSeconds;
  const hider = new TestHider();
  const match = startMatch(spec, pool, {
    hider: withTestBrain(script.createController<HideSeekAgent>({ seed }), hider.brain),
    seeker: withTestBrain(script.createController<HideSeekAgent>({ seed }), testSeekerBrain()),
  });
  hider.watch(match.state.boxes);
  return match;
}

/**
 * One match in the script's first room, played by the test players
 * instead of trained brains. Their act line, rewards and stop rules are
 * exactly what the script says. Same numbers every time. Returns null if
 * the signal aborts.
 */
export async function playTestMatch(prepared: PreparedHideSeek, signal?: AbortSignal): Promise<TestMatchMetrics | null> {
  if (!prepared.blueprint) throw new Error('Test matches need a Hide and Seek brain.');
  const match = startTestMatch(prepared, await lessonArenaPool());
  try {
    const walked = odometer(match.state.agents);
    if (!(await playMatch(match, signal, walked.step))) return null;
    const r = match.result();
    return {
      hiderReward: r.hiderReward,
      seekerReward: r.seekerReward,
      rewardSum: r.hiderReward + r.seekerReward,
      hiddenShare: r.hiddenShare,
      seenShare: r.seenShare,
      hiderDistance: walked.meters[0],
      seekerDistance: walked.meters[1],
      grabs: r.hiderGrabs + r.seekerGrabs,
      locks: r.locksPlaced,
      boxesMoved: r.boxesMoved,
      inputs: match.observation(0).length,
    };
  } finally {
    match.release();
  }
}
