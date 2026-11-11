'use client';

import { useCallback } from 'react';
import { NavigationCanvas } from '@/render/navigation/NavigationCanvas';
import type { NavQualityTier } from '@/render/navigation/types';
import { isWatchSpeed } from '@/workers/shared/protocol';
import { viewportHeld } from '@/features/lab/state/labState';
import { useNavigationLab } from '../state/labStore';
import type { LabFeeds } from './labFeeds';

interface Props {
  feeds: LabFeeds;
  /** `?quality=ultra` draws past High, for screenshots. */
  ultra: boolean;
  onReady: (ready: boolean) => void;
}

/**
 * The Navigation lab's viewport: the course scene fed by the lab's
 * streams, with the camera, the Inputs overlay and the render tier from
 * the store. It tells the store which runner it follows, so the inputs
 * panels and the streamed inputs follow the same one.
 */
export function NavigationViewport({ feeds, ultra, onReady }: Props) {
  const tier = useNavigationLab((s) => s.activeTier);
  const camera = useNavigationLab((s) => s.camera);
  const sensors = useNavigationLab((s) => s.inputsOverlay);
  const hovered = useNavigationLab((s) => s.hoveredInput);
  const held = useNavigationLab(viewportHeld);
  // Paused at a watch speed nothing moves (the ghosts pause too), so it only draws on demand.
  const live = useNavigationLab((s) => !(s.status === 'paused' && s.mode === 'train' && isWatchSpeed(s.speed)));
  // While idle, these redraw for a moment: the view toggle, a new course, a new run.
  const wake = useNavigationLab((s) => `${s.view}:${s.run?.id}:${s.content?.generation}:${s.focus.kind}`);
  const onFollow = useCallback((ghost: boolean, index: number) => useNavigationLab.getState().set({ followed: index, viewFollowsGhost: ghost }), []);
  const drawTier: NavQualityTier = ultra && tier === 'high' ? 'ultra' : tier;
  return (
    <NavigationCanvas
      getFeed={feeds.getFeed}
      getGhosts={feeds.getGhosts}
      tier={drawTier}
      camera={camera}
      sensors={sensors}
      live={live}
      held={held}
      hoveredInput={hovered ?? -1}
      onReady={onReady}
      onFollow={onFollow}
      wake={wake}
    />
  );
}
