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
