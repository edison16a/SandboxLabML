import type { AgentController } from '../../env/types';
import type { HideSeekAgent } from '../agents/agent';
import { scriptedHiderController } from '../scriptedHider';
import { scriptedSeekerController } from '../scriptedSeeker';
import { hideSeekBrainInputs } from '../sensing/inputSchema';
import type { MatchTeamSpec } from './types';

/**
 * The hand-written agent for a team a spec marks as scripted. Its brain is
 * a stand-in genome, which may have extra inputs for a script's sensors,
 * so the controller declares that many sensor slots and leaves them at 0.
 * The scripted agents never read their brain, so the values do not matter,
 * but the brain shape check still has to pass.
 */
export function scriptedTeamController(team: MatchTeamSpec, isHider: boolean): AgentController<HideSeekAgent> {
  const base = isHider ? scriptedHiderController : scriptedSeekerController;
  const extra = team.genome.inputs.length - hideSeekBrainInputs(team.inputs);
  if (extra <= 0) return base;
  return {
    customSensorCount: extra,
    sensors(_a: HideSeekAgent, out: Float64Array, offset: number) {
      out.fill(0, offset, offset + extra);
    },
    tick: base.tick,
  };
}
