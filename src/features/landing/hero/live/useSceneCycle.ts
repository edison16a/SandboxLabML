'use client';

import { useEffect, useState } from 'react';
import { firstScene, nextScene, SCENE_FADE_MS, SCENE_HOLD_MS, type HeroScene, type SceneReady } from '../sceneCycle';

export interface SceneCycle {
  scene: HeroScene;
  /** True during a crossfade, while both scenes must draw. */
  fading: boolean;
}

/**
 * Takes the hero back and forth between its scenes: each holds for a few
 * seconds and then crossfades into the other. The clock only runs while
 * the hero is active and the scene on screen has drawn, so a visitor who
 * scrolls away and back finds the scene they left.
 */
export function useSceneCycle(ready: SceneReady, active: boolean): SceneCycle {
  const [scene, setScene] = useState<HeroScene>('car');
  const [fading, setFading] = useState(false);
  const { car, arena } = ready;

  // A scene that never became ready hands over to the other at once.
  useEffect(() => {
    const now = { car, arena };
    if (!now[scene] && (car || arena)) setScene(firstScene(now));
  }, [scene, car, arena]);

  useEffect(() => {
    if (!active || !{ car, arena }[scene]) return;
    const hold = setTimeout(() => {
      const next = nextScene(scene, { car, arena });
      if (next === scene) return;
      setScene(next);
      setFading(true);
    }, SCENE_HOLD_MS);
    return () => clearTimeout(hold);
  }, [active, scene, car, arena]);

  useEffect(() => {
    if (!fading) return;
    const done = setTimeout(() => setFading(false), SCENE_FADE_MS);
    return () => clearTimeout(done);
  }, [fading]);

  return { scene, fading };
}
