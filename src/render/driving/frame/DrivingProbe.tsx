'use client';

import { StatsProbe } from '@/render/shared/StatsProbe';
import { DRIVING_CAMERAS, useDrivingScene } from './sceneContext';
import type { FrameSource } from './source';

/**
 * Publishes the city's counters on window.__sbl for the browser tests: how
 * many SUVs and past champions are drawn, who is followed, the camera, the
 * lidar beams on screen and the city's own cars and people.
 */
export function DrivingProbe({ ghosts }: { ghosts?: FrameSource | null }) {
  const { frame, view, population } = useDrivingScene();
  return (
    <StatsProbe
      instances={() => ({
        population: population?.count ?? 0,
        ghosts: ghosts?.count ?? 0,
        focus: frame.focus,
        camera: DRIVING_CAMERAS.indexOf(view.camera),
        beams: view.sensors && frame.sense.valid && frame.focus >= 0 ? frame.sense.beams : 0,
        cars: frame.world?.carCount ?? 0,
        people: frame.world?.pedCount ?? 0,
      })}
    />
  );
}
