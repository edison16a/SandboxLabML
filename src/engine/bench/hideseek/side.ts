import { PRESET_BLUEPRINTS } from '../../blueprints/presets';
import type { HideSeekInputConfig } from '../../hideseek/inputConfig';
import { hideSeekBrainInputs } from '../../hideseek/sensing/inputSchema';
import type { Genome } from '../../neat/types';
import { createScriptHost, type ScriptHostAdapter } from '../../script/host';
import { hideSeekBlueprints } from '../../training/hideseekRunConfig';
import type { RunConfig } from '../../training/runConfig';
import type { ExamSide, ExamTeam, HideSeekModel } from './types';

/**
 * The run's script, compiled for its sensors. Sensors are part of the
 * brain's shape, so every script version of a run has the same ones and
 * the latest is used. A script that no longer compiles gives no sensors,
 * and the input check below then names the mismatch.
 */
function scriptHost(config: RunConfig, blueprintIds: string[]): ScriptHostAdapter | null {
  const source = config.scripts[config.scripts.length - 1]?.source;
  if (!source) return null;
  try {
    return createScriptHost(source, { blueprints: [...PRESET_BLUEPRINTS.map((b) => b.id), ...blueprintIds] });
  } catch {
    return null;
  }
}

/** Throws when a genome does not fit what its team senses, which means it came from a different run. */
export function checkTeam(role: 'hider' | 'seeker', genome: Genome, inputs: HideSeekInputConfig, customSensors: number): void {
  const expected = hideSeekBrainInputs(inputs, customSensors);
  if (genome.inputs.length !== expected) throw new Error(`This ${role} brain has ${genome.inputs.length} inputs, but the run gives ${expected}.`);
}

/**
 * A run's champion pair, ready for the exam. Each team gets its own
 * blueprint's inputs (seekers may sense differently from hiders) plus the
 * script's sensors, so the exam feeds every brain exactly what it trained
 * with, whatever its shape.
 */
export function examSideFor(config: RunConfig, model: HideSeekModel): ExamSide {
  const bp = hideSeekBlueprints(config);
  const host = scriptHost(config, [bp.hider.id, bp.seeker.id]);
  const custom = host?.customSensors.length ?? 0;
  const team = (role: 'hider' | 'seeker', genome: Genome, inputs: HideSeekInputConfig): ExamTeam => {
    checkTeam(role, genome, inputs, custom);
    return { genome, inputs, sensors: host && custom > 0 ? (seed) => host.createHideSeekControllers(seed)[role] : null };
  };
  return { hider: team('hider', model.hider, bp.hider.inputs), seeker: team('seeker', model.seeker, bp.seeker.inputs) };
}
