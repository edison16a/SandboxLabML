'use client';

import * as THREE from 'three';
import { useRef } from 'react';
import { Buildings } from './city/buildings/Buildings';
import { CityGround } from './city/ground/CityGround';
import { Streetscape } from './city/streetscape/Streetscape';
import { useDrivingScene } from './frame/sceneContext';
import { People } from './people/People';
import { PopulationSuvs } from './population/PopulationSuvs';
import { TIERS } from './quality';
import { SensorOverlay } from './sensors/SensorOverlay';
import { FollowedSuv } from './suv/FollowedSuv';
import { TrafficCars } from './traffic/TrafficCars';
import { CityEnvironment } from './world/CityEnvironment';

/**
 * Everything in the city, static and alive: light and sky, the streets and
 * buildings, street furniture and signals, traffic and people, the
 * population of SUVs, and the followed SUV with its sensors.
 */
export function CityScene({ target }: { target: React.RefObject<THREE.Vector3> }) {
  const { city, tier } = useDrivingScene();
  const shadows = TIERS[tier].shadows;
  const box = useRef(new THREE.Vector3(1e9, 0, 0));
  return (
    <>
      <CityEnvironment tier={tier} focus={target} box={box} />
      <CityGround city={city} tier={tier} shadows={shadows} />
      <Buildings city={city} tier={tier} shadows={shadows} />
      <Streetscape city={city} tier={tier} />
      <TrafficCars />
      <People />
      <PopulationSuvs />
      <FollowedSuv />
      <SensorOverlay />
    </>
  );
}
