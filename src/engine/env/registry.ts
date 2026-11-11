import { HIDESEEK_ENGINE_VERSION } from '../core/version';
import { racingModule } from '../racing/module';
import type { AnyEpisodeModule } from './episode';
import type { EnvId } from './types';

/**
 * Every single population env, by id. This is the one engine entry a new
 * env adds: the trainer, the sim and replay workers, run storage, the
 * benchmark and the lessons all find an env here. Hide and Seek trains two
 * teams in many arenas, a different shape, so it is not listed.
 */
const modules = new Map<string, AnyEpisodeModule>([[racingModule.id, racingModule]]);

/** The module for an env id, or undefined for an env this build does not have (such as one a later build removed). */
export function episodeModule(env: string): AnyEpisodeModule | undefined {
  return modules.get(env);
}

/** Like episodeModule, for code paths that only run for a known env. */
export function requireEpisodeModule(env: string): AnyEpisodeModule {
  const m = modules.get(env);
  if (!m) throw new Error(`There is no environment called ${env} in this build.`);
  return m;
}

export function isEpisodeEnv(env: string): env is EnvId {
  return modules.has(env);
}

/**
 * Envs whose runs this build can open: every episode env, plus Hide and
 * Seek, which trains two teams its own way. Stored runs of any other env
 * (one a later build removed) are hidden rather than opened.
 */
export function isKnownEnv(env: string): env is EnvId {
  return env === 'hideseek' || modules.has(env);
}

/** The engine version a run of `env` is stamped with and checked against. */
export function engineVersionOf(env: EnvId): number {
  return env === 'hideseek' ? HIDESEEK_ENGINE_VERSION : requireEpisodeModule(env).engineVersion;
}

/** Ids of every registered env, in registration order. */
export function episodeEnvIds(): EnvId[] {
  return [...modules.keys()] as EnvId[];
}

/**
 * Adds a module at run time. Only tests use it, to drive the generic
 * pipeline with a toy env; the app registers its envs in the map above.
 */
export function registerEpisodeModule(module: AnyEpisodeModule): () => void {
  modules.set(module.id, module);
  return () => modules.delete(module.id);
}
