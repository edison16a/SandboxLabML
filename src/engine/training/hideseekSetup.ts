import type { AgentController } from '../env/types';
import type { HideSeekAgent } from '../hideseek/agents/agent';
import type { MatchControllers } from '../hideseek/match/types';
import type { HideSeekTrainerOptions } from '../hideseek/trainer/types';
import { hideSeekBlueprints, hideSeekSettingsOf } from './hideseekRunConfig';
import { scriptAt, type RunConfig } from './runConfig';
import { builtinHost, hostFor, type ScriptHost } from './scriptHost';

/** Script sensors per team, appended after the built-in inputs. */
export interface HideSeekSensorCounts {
  hider: number;
  seeker: number;
}

/**
 * Trainer options for a run. Both teams get the run's NEAT settings; the
 * blueprints decide what each team senses. Script sensor counts come from
 * the script host, since only a compiled script knows them.
 */
export function hideSeekTrainerOptions(config: RunConfig, sensors: HideSeekSensorCounts = { hider: 0, seeker: 0 }): HideSeekTrainerOptions {
  const s = hideSeekSettingsOf(config);
  const bp = hideSeekBlueprints(config);
  return {
    seed: config.seed,
    hiderInputs: bp.hider.inputs,
    seekerInputs: bp.seeker.inputs,
    populationSize: s.populationPerTeam,
    hiderNeat: { ...config.neat, populationSize: s.populationPerTeam },
    seekerNeat: { ...config.neat, populationSize: s.populationPerTeam },
    activation: bp.hider.activation,
    wiring: bp.hider.wiring,
    hiddenCount: bp.hider.hiddenCount,
    hiderCustomSensors: sensors.hider,
    seekerCustomSensors: sensors.seeker,
    layouts: s.layouts,
    rounds: s.rounds,
    hallOfFameSize: s.hallOfFameSize,
    reward: s.reward,
    setup: s.setup,
    physics: s.physics,
  };
}

/** The script in force when a run starts, or null for built-in rewards. */
export function hideSeekScriptSource(config: RunConfig, generation = 0): string | null {
  return scriptAt(config, generation)?.source ?? null;
}

/**
 * A script host that never throws. Hide and Seek scripts are new, and a
 * script that does not compile for this game must not stop training, so a
 * failure falls back to the built-in rewards and reports why.
 */
export function safeHideSeekHost(source: string | null): { host: ScriptHost; error: string | null } {
  if (!source) return { host: builtinHost, error: null };
  try {
    return { host: hostFor(source), error: null };
  } catch (err) {
    return { host: builtinHost, error: err instanceof Error ? err.message : String(err) };
  }
}

/** Script controllers for one match, seeded like the match. Empty when the host has none, which means built-in rewards. */
export function hideSeekControllers(host: ScriptHost, seed: number): MatchControllers {
  if (!host.createHideSeekControllers) return {};
  const c = host.createHideSeekControllers(seed);
  return { hider: c.hider, seeker: c.seeker };
}

/** How many script sensors each team gets, read from a throwaway pair of controllers. */
export function hideSeekSensorCounts(host: ScriptHost): HideSeekSensorCounts {
  const c = hideSeekControllers(host, 0);
  const count = (x: AgentController<HideSeekAgent> | undefined) => x?.customSensorCount ?? 0;
  return { hider: count(c.hider), seeker: count(c.seeker) };
}
