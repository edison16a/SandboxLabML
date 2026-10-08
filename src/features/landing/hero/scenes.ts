/** The two live scenes of the hero. */
export type HeroScene = 'car' | 'arena';

/** Which scenes have warmed up and are showing over the poster. */
export type SceneReady = Record<HeroScene, boolean>;
