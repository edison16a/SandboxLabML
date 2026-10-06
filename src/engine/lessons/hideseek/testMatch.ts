import { blueprintShape } from '../../blueprints/shape';
import type { HideSeekAgent } from '../../hideseek/agents/agent';
import { startMatch } from '../../hideseek/match/runMatch';
import type { MatchSpec } from '../../hideseek/match/types';
import { Population } from '../../neat/population';
import type { PreparedHideSeek } from '../prepare';
import type { TestMatchMetrics } from './metrics';
import { lessonArenaPool, playMatch } from './play';
import { TestHider, testSeekerBrain, withTestBrain } from './testPlayers';

/** Seed of every test match: where the players start and how the boxes are jittered. */
export const TEST_MATCH_SEED = 12;
/** Seed of the stand-in genomes. Their outputs are replaced by the test players, so only their shape matters. */
const TEST_GENOME_SEED = 0x7e57;

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
 * One match in the script's first room, played by the two fixed test
 * players (see testPlayers.ts) instead of trained brains. The script's own
 * each tick block runs for both every tick, so its act line, rewards and
 * stop rules are exactly what the players live by. Same numbers every
 * time. Returns null if the signal aborts.
 */
export async function playTestMatch(prepared: PreparedHideSeek, signal?: AbortSignal): Promise<TestMatchMetrics | null> {
  const blueprint = prepared.blueprint;
  if (!blueprint) throw new Error('Test matches need a Hide and Seek brain.');
  const { script, rules } = prepared;
  const genome = Population.create(blueprintShape(blueprint, script.sensors.length), TEST_GENOME_SEED, { populationSize: 1 }).genomes[0];
  const team = { genome, inputs: blueprint.inputs };
  const spec: MatchSpec = { layout: rules.layout, seed: TEST_MATCH_SEED, hider: team, seeker: team };
  if (rules.prepSeconds !== undefined) spec.prepSeconds = rules.prepSeconds;
  const hider = new TestHider();
  const pool = await lessonArenaPool();
  const match = startMatch(spec, pool, {
    hider: withTestBrain(script.createController<HideSeekAgent>({ seed: spec.seed }), hider.brain),
    seeker: withTestBrain(script.createController<HideSeekAgent>({ seed: spec.seed }), testSeekerBrain()),
  });
  try {
    hider.watch(match.state.boxes);
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
      inputs: genome.inputs.length,
    };
  } finally {
    match.release();
  }
}
