/** The two live scenes of the hero: the SUV in the city and the runner on its course. */
export type HeroScene = 'drive' | 'run';

/** Which scenes have warmed up and are showing over the poster. */
export type SceneReady = Record<HeroScene, boolean>;
