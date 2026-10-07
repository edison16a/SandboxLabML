import type { HideSeekBlueprint } from '../blueprints/types';
import { DEFAULT_HIDESEEK_SETUP, HIDESEEK_SETUPS } from '../hideseek/trainer/setups';
import type { HideSeekSetupId } from '../hideseek/trainer/types';
import { hashObject } from '../core/hash';
import { HIDESEEK_ENGINE_VERSION } from '../core/version';
import { HIDESEEK_LAYOUT_IDS } from '../hideseek/layouts/presets';
import type { HideSeekLayoutId } from '../hideseek/layouts/types';
import { DEFAULT_HIDESEEK_PHYSICS, hideSeekPhysicsHash, normalizeHideSeekPhysics, type HideSeekPhysics } from '../hideseek/physics';
import { normalizeHideSeekBlueprint } from '../blueprints/normalize';
import type { HideSeekRewardId } from '../hideseek/rewards';
import { neatConfig } from '../neat/config';
import { newRunId, type RunConfig } from './runConfig';

/**
 * The Hide and Seek part of a run config. RunConfig keeps it opaque so the
 * shared config file does not depend on this engine; this file owns the
 * real shape and the only cast.
 */
export interface HideSeekSettings {
  /** Rooms, cycled by round. */
  layouts: HideSeekLayoutId[];
  /** Rounds per generation, 1 to 4. */
  rounds: number;
  /** Genomes in each team. */
  populationPerTeam: number;
  /** Built-in rewards for teams without a script. */
  reward: HideSeekRewardId;
  physics: HideSeekPhysics;
  /** Past champions kept per team as opponents. */
  hallOfFameSize: number;
  /** Seekers can sense differently from hiders. Missing means they share the run blueprint. */
  seekerBlueprint?: HideSeekBlueprint;
  /**
   * Named training setup: v2 (cover rewards, a sparring round, mixed rooms)
   * learns visibly faster and is the default for new runs. Runs saved before
   * setups existed read back as v1, so they keep playing the rules they trained under.
   */
  setup: HideSeekSetupId;
}

export interface NewHideSeekRun {
  name: string;
  seed: number;
  /** Hider blueprint, and the seeker one unless `seekerBlueprint` is given. */
  blueprint: HideSeekBlueprint;
  seekerBlueprint?: HideSeekBlueprint;
  populationPerTeam: number;
  layouts?: HideSeekLayoutId[];
  rounds?: number;
  reward?: HideSeekRewardId;
  physics?: HideSeekPhysics;
  hallOfFameSize?: number;
  script?: { source: string; hash: string; customSensors: number };
}

/** Fingerprint of everything a brain was trained under: the rules and what each team senses. */
export function hideSeekRunHash(physics: HideSeekPhysics, hider: HideSeekBlueprint, seeker: HideSeekBlueprint): string {
  return hashObject({ physics: hideSeekPhysicsHash(physics), hider: hider.inputs, seeker: seeker.inputs });
}

/** Builds a frozen Hide and Seek run config. Layouts and rounds are checked so a bad form cannot start a run. */
export function createHideSeekRunConfig(input: NewHideSeekRun): RunConfig {
  const layouts = input.layouts?.length ? [...new Set(input.layouts)] : [...HIDESEEK_LAYOUT_IDS];
  const rounds = Math.round(input.rounds ?? 4);
  if (rounds < 1 || rounds > 4) throw new Error('A generation has 1 to 4 rounds.');
  const physics = input.physics ?? DEFAULT_HIDESEEK_PHYSICS;
  const bp = input.blueprint;
  const seekerBp = input.seekerBlueprint ?? bp;
  const settings: HideSeekSettings = {
    layouts,
    rounds,
    populationPerTeam: Math.max(2, Math.round(input.populationPerTeam)),
    reward: input.reward ?? HIDESEEK_SETUPS[DEFAULT_HIDESEEK_SETUP].reward,
    setup: DEFAULT_HIDESEEK_SETUP,
    physics,
    hallOfFameSize: input.hallOfFameSize ?? 20,
    ...(input.seekerBlueprint ? { seekerBlueprint: input.seekerBlueprint } : {}),
  };
  return {
    id: newRunId(),
    name: input.name,
    env: 'hideseek',
    seed: input.seed >>> 0,
    createdAt: Date.now(),
    engineVersion: HIDESEEK_ENGINE_VERSION,
    physicsHash: hideSeekRunHash(physics, bp, seekerBp),
    blueprint: bp,
    scripts: input.script ? [{ fromGeneration: 0, source: input.script.source, hash: input.script.hash }] : [],
    customSensors: input.script?.customSensors ?? 0,
    neat: neatConfig({
      populationSize: settings.populationPerTeam,
      ...(bp.neat ?? {}),
      mutation: { ...neatConfig().mutation, ...(bp.neat?.mutation ?? {}) },
    }),
    hideseek: settings as unknown as Record<string, unknown>,
  };
}

/**
 * Reads the settings back, filling anything a run saved by an older build
 * left out. Throws for a run of another environment.
 */
export function hideSeekSettingsOf(config: RunConfig): HideSeekSettings {
  if (config.env !== 'hideseek' || config.blueprint.env !== 'hideseek') throw new Error('Not a Hide and Seek run');
  const s = (config.hideseek ?? {}) as Partial<HideSeekSettings>;
  return {
    layouts: s.layouts?.length ? s.layouts : [...HIDESEEK_LAYOUT_IDS],
    rounds: s.rounds ?? 4,
    populationPerTeam: s.populationPerTeam ?? config.neat.populationSize,
    reward: s.reward ?? 'v1',
    setup: s.setup ?? 'v1',
    physics: s.physics ? normalizeHideSeekPhysics(s.physics) : DEFAULT_HIDESEEK_PHYSICS,
    hallOfFameSize: s.hallOfFameSize ?? 20,
    ...(s.seekerBlueprint ? { seekerBlueprint: normalizeHideSeekBlueprint(s.seekerBlueprint) } : {}),
  };
}

/** Blueprints of both teams. Seekers fall back to the run blueprint. */
export function hideSeekBlueprints(config: RunConfig): { hider: HideSeekBlueprint; seeker: HideSeekBlueprint } {
  const settings = hideSeekSettingsOf(config);
  const hider = normalizeHideSeekBlueprint(config.blueprint as HideSeekBlueprint);
  return { hider, seeker: settings.seekerBlueprint ?? hider };
}
