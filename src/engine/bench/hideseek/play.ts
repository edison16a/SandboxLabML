import type { AgentController, TickIO } from '../../env/types';
import type { HideSeekAgent } from '../../hideseek/agents/agent';
import { runMatch } from '../../hideseek/match/runMatch';
import type { MatchResult } from '../../hideseek/match/types';
import type { ArenaPool } from '../../hideseek/world/pool';
import { HS_BENCH_PHYSICS } from './exam';
import type { ExamOpponent, ExamSide, ExamStart, ExamTeam, GameResult } from './types';

/**
 * The exam's controller. It feeds the brain its script's sensors, so a
 * brain trained with them sees what it learned with, but it applies the
 * brain's outputs straight to the agent and never rewards or stops
 * anything. Training rewards cannot change an exam score.
 */
function examController(team: ExamTeam, seed: number): AgentController<HideSeekAgent> {
  const script = team.sensors?.(seed) ?? null;
  return {
    customSensorCount: script?.customSensorCount ?? 0,
    sensors(a: HideSeekAgent, out: Float64Array, offset: number) {
      script?.sensors(a, out, offset);
    },
    tick(_a: HideSeekAgent, io: TickIO) {
      for (let k = 0; k < io.action.length; k++) io.action[k] = io.brain[k];
    },
  };
}

/** Plays one exam match under the exam's fixed rules. A pure function of its arguments, like runMatch. */
export function playLeg(pool: ArenaPool, start: ExamStart, hider: ExamTeam, seeker: ExamTeam): MatchResult {
  const spec = {
    layout: start.layout,
    seed: start.seed,
    hider: { genome: hider.genome, inputs: hider.inputs },
    seeker: { genome: seeker.genome, inputs: seeker.inputs },
    physics: HS_BENCH_PHYSICS,
  };
  return runMatch(spec, pool, { hider: examController(hider, start.seed), seeker: examController(seeker, start.seed) });
}

/** One game: the model hides from the opponent's seeker, then seeks the opponent's hider, from the same start. */
export function playGame(pool: ArenaPool, start: ExamStart, model: ExamSide, opponent: ExamOpponent): GameResult {
  const hiding = playLeg(pool, start, model.hider, opponent.side.seeker);
  const seeking = playLeg(pool, start, opponent.side.hider, model.seeker);
  return {
    opponent: opponent.tier,
    layout: start.layout,
    seed: start.seed,
    hidden: hiding.hiddenShare,
    covered: 1 - (hiding.exposedShare ?? 0),
    locks: hiding.hiderLocks,
    seen: seeking.seenShare,
  };
}
