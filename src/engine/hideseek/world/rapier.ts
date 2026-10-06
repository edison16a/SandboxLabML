import RAPIER from '@dimforge/rapier3d-compat';

/** The Rapier module, usable once `loadRapier` has resolved. */
export type Rapier = typeof RAPIER;

let loading: Promise<Rapier> | null = null;

/**
 * Loads Rapier's WASM once per thread. The compat build embeds the binary,
 * so this works the same in Node, the browser and Web Workers.
 */
export function loadRapier(): Promise<Rapier> {
  loading ??= RAPIER.init().then(() => RAPIER);
  return loading;
}
