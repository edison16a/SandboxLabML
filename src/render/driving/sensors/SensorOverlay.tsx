'use client';

import { useDrivingScene } from '../frame/sceneContext';
import { Destination } from './Destination';
import { Detections } from './Detections';
import { IntentChevrons } from './IntentChevrons';
import { LidarBeams } from './LidarBeams';
import { LightTarget } from './LightTarget';
import { RouteRibbon } from './RouteRibbon';

/**
 * Everything the followed SUV senses and plans, drawn into the world: the
 * route ahead on the road, chevrons where it is about to be, its lidar,
 * boxes round what it has detected, the light it is reading and where it
 * means to stop. The Inputs control in the lab turns it on and off.
 */
export function SensorOverlay() {
  const { route, view } = useDrivingScene();
  if (!view.sensors || !route) return null;
  return (
    <group>
      <RouteRibbon route={route} />
      <Destination route={route} />
      <IntentChevrons />
      <LidarBeams />
      <Detections />
      <LightTarget route={route} />
    </group>
  );
}
