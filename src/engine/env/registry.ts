import { drivingInfo } from '../driving/info';
import { navigationInfo } from '../navigation/info';
import type { AnyEpisodeModule, EpisodeEnvInfo } from './episode';
import type { EnvId } from './types';

/**
 * Every single population env, by id. This is the one engine entry a new
 * env adds: the trainer, the sim and replay workers, run storage, the
 * benchmark and the lessons all find an env here.
 *
 * The map holds each env's light info. Its module, with the simulation,
 * loads on demand through `loadEpisodeModule`, so a page that only lists
 * runs or checks scripts never ships an env's engine.
 */
const infos = new Map<string, EpisodeEnvInfo>([
  [drivingInfo.id, drivingInfo],
  [navigationInfo.id, navigationInfo],
]);

const loaded = new Map<string, AnyEpisodeModule>();
const loading = new Map<string, Promise<AnyEpisodeModule>>();

/** The info of an env id, or undefined for an env this build does not have (such as one a later build removed). */
export function episodeInfo(env: string): EpisodeEnvInfo | undefined {
  return infos.get(env);
}

/** Like episodeInfo, for code paths that only run for a known env. */
export function requireEpisodeInfo(env: string): EpisodeEnvInfo {
  const info = infos.get(env);
  if (!info) throw new Error(`There is no environment called ${env} in this build.`);
  return info;
}

/** Loads an env's module once per thread. Workers and labs await it before they simulate. */
export function loadEpisodeModule(env: string): Promise<AnyEpisodeModule> {
  const ready = loaded.get(env);
  if (ready) return Promise.resolve(ready);
  let pending = loading.get(env);
  if (!pending) {
    pending = requireEpisodeInfo(env)
      .load()
      .then((m) => {
        loaded.set(env, m);
        return m;
      })
      .finally(() => loading.delete(env));
    loading.set(env, pending);
  }
  return pending;
}

/** The module of an env this thread already loaded. Throws when no one awaited loadEpisodeModule first. */
export function requireEpisodeModule(env: string): AnyEpisodeModule {
  const m = loaded.get(env);
  if (!m) throw new Error(infos.has(env) ? `The ${env} environment has not loaded yet.` : `There is no environment called ${env} in this build.`);
  return m;
}

/**
 * True for an env this build has. Stored runs, scripts and files of any
 * other env (one a later build removed) are hidden or refused rather than
 * opened.
 */
export function isEpisodeEnv(env: string): env is EnvId {
  return infos.has(env);
}

/** The engine version a run of `env` is stamped with and checked against. */
export function engineVersionOf(env: EnvId): number {
  return requireEpisodeInfo(env).engineVersion;
}

/** Display name of an env, such as "Driving". */
export function envLabel(env: EnvId): string {
  return infos.get(env)?.label ?? env;
}

/** Ids of every registered env, in registration order. */
export function episodeEnvIds(): EnvId[] {
  return [...infos.keys()] as EnvId[];
}

/**
 * Adds a module, already loaded, at run time. Only tests use it, to drive
 * the generic pipeline with a toy env; the app lists its envs in the map
 * above. The returned function takes it out again.
 */
export function registerEpisodeModule(module: AnyEpisodeModule): () => void {
  infos.set(module.id, module as EpisodeEnvInfo);
  loaded.set(module.id, module);
  return () => {
    infos.delete(module.id);
    loaded.delete(module.id);
  };
}
