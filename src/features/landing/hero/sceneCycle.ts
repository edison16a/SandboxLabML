/** The two live scenes behind the hero text. */
export type HeroScene = 'car' | 'arena';

/** How long a scene holds before the other one fades in, ms. */
export const SCENE_HOLD_MS = 13_000;
/** How long the crossfade between scenes takes, ms. Both scenes draw while it runs. */
export const SCENE_FADE_MS = 1_400;

/** Which scenes have drawn their first frames and can be shown. */
export type SceneReady = Record<HeroScene, boolean>;

/**
 * The scene to show after `current`. The car opens the hero, since its
 * scene loads first, and the two take turns once both are ready. A scene
 * that failed to load is simply never ready, so the other one stays.
 */
export function nextScene(current: HeroScene, ready: SceneReady): HeroScene {
  const other: HeroScene = current === 'car' ? 'arena' : 'car';
  return ready[other] ? other : current;
}

/** The scene to open with: the car when it is ready, else whichever is. */
export function firstScene(ready: SceneReady): HeroScene {
  return ready.car || !ready.arena ? 'car' : 'arena';
}
