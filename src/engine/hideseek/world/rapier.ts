import type RAPIER from '@dimforge/rapier3d-compat';

/** The Rapier module, usable once `loadRapier` has resolved. */
export type Rapier = typeof RAPIER;

let loading: Promise<Rapier> | null = null;

/**
 * Loads Rapier's WASM once per thread. The compat build embeds the binary,
 * so this works the same in Node, the browser and Web Workers. The package
 * is imported here on first use rather than at the top of the file: it is
 * a 4 MB chunk, and a thread that only replays cars (the landing hero, a
 * Racing lab) should never wait for it. A failed load is tried again on
 * the next call, since in the browser it is a download.
 */
export function loadRapier(): Promise<Rapier> {
  loading ??= import('@dimforge/rapier3d-compat')
    .then(async ({ default: R }) => {
      await R.init();
      return R;
    })
    .catch((err: unknown) => {
      loading = null;
      throw err;
    });
  return loading;
}
