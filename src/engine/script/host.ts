import type { Rng } from '../core/rng';
import type { AgentController } from '../env/types';
import type { HideSeekAgent } from '../hideseek/agents/agent';
import type { NeatConfig } from '../neat/config';
import type { RacingCar } from '../racing/car/runtime';
import type { CustomSensorSpec } from '../racing/sensors/inputSchema';
import type { Track } from '../racing/track/types';
import type { CheckOptions } from './checker';
import { compileScript } from './compiler';
import { lineOf, type Diagnostic } from './diagnostics';
import type { GenerationContext, GenerationDirectives } from './generationTypes';

/**
 * The shape the training layer's ScriptHost expects. It is declared here
 * instead of imported, so the language package does not depend on the
 * trainer, and TypeScript matches the two structurally.
 */
export interface ScriptHostAdapter {
  readonly customSensors: CustomSensorSpec[];
  createRacingController(seed: number, track: Track): AgentController<RacingCar>;
  /**
   * One controller per Hide and Seek team for a match with this seed. Both
   * run the same each tick block (a script tells the teams apart with
   * agent.isHider), and both add the script's sensors to their brain.
   */
  createHideSeekControllers(seed: number): { hider: AgentController<HideSeekAgent>; seeker: AgentController<HideSeekAgent> };
  runGeneration(ctx: GenerationContext, rng: Rng, neat: NeatConfig): GenerationDirectives;
}

/** Thrown by createScriptHost when the script has errors. The editor should have shown them already. */
export class ScriptCompileError extends Error {
  constructor(
    readonly diagnostics: Diagnostic[],
    source: string,
  ) {
    const first = diagnostics.find((d) => d.severity === 'error');
    super(first ? `Line ${lineOf(source, first.span.from)}: ${first.message}` : 'The script has errors.');
    this.name = 'ScriptCompileError';
  }
}

/** Compiles a script for the trainer. Pass this to registerScriptHostFactory. */
export function createScriptHost(source: string, opts: CheckOptions = {}): ScriptHostAdapter {
  const { script, diagnostics } = compileScript(source, opts);
  if (!script) throw new ScriptCompileError(diagnostics, source);
  return {
    customSensors: script.sensors,
    createRacingController: (seed, track) => script.createController<RacingCar>({ seed, track }),
    createHideSeekControllers: (seed) => ({
      hider: script.createController<HideSeekAgent>({ seed }),
      seeker: script.createController<HideSeekAgent>({ seed }),
    }),
    runGeneration: (ctx, rng, neat) => script.runGeneration(ctx, rng, neat),
  };
}
