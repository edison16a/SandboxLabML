'use client';

import * as THREE from 'three';
import { useMemo } from 'react';
import type { Track } from '@/engine/racing/track/types';
import { RUNOFF } from '@/engine/racing/car/runtime';
import { useDisposable } from '@/render/shared/useDisposable';
import { barrierGeometry, createWallMaterial } from './track/barrierGeometry';
import { kerbGeometry } from './track/kerbs';
import { racingLine } from './track/racingLine';
import { roadGeometry, runoffGeometry } from './track/roadGeometry';
import { createAsphaltMaterial, createPaintMaterial, createRunoffMaterial } from './track/roadMaterials';
import { StartLine } from './track/StartLine';
import { ribbon } from './trackGeometry';
import { withHaze } from './world/atmosphere';
import { detailNoise, releaseDetailNoise } from './world/detailNoise';

/** Where the safety walls stand, m from the centerline: just past the run-off, where the simulation calls a crash. */
export function barrierOffset(track: Track): number {
  return track.halfWidth + RUNOFF + 1.2;
}

/** The road, its markings, kerbs, run-off, walls and the start line. */
export function TrackMesh({ track }: { track: Track }) {
  const hw = track.halfWidth;
  const line = useMemo(() => racingLine(track), [track]);
  const geo = useDisposable(() => {
    const g = {
      road: roadGeometry(track, line),
      runoffL: runoffGeometry(track, hw, hw + RUNOFF + 0.8),
      runoffR: runoffGeometry(track, -hw - RUNOFF - 0.8, -hw),
      lineL: ribbon(track, hw - 0.42, hw - 0.18, 0.02),
      lineR: ribbon(track, -hw + 0.18, -hw + 0.42, 0.02),
      walls: barrierGeometry(track, barrierOffset(track)),
      kerbs: kerbGeometry(track),
    };
    return { ...g, dispose: () => Object.values(g).forEach((x) => x?.dispose()) };
  }, [track, line]);

  const mats = useDisposable(() => {
    const noise = detailNoise();
    const m = {
      asphalt: createAsphaltMaterial(noise, hw * 2),
      runoff: createRunoffMaterial(noise),
      paint: createPaintMaterial(noise),
      kerb: withHaze(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide })),
      wall: withHaze(createWallMaterial()),
    };
    return { ...m, dispose: () => (Object.values(m).forEach((x) => x.dispose()), releaseDetailNoise()) };
  }, [hw]);

  return (
    <group>
      <mesh geometry={geo.road} material={mats.asphalt} receiveShadow />
      <mesh geometry={geo.runoffL} material={mats.runoff} receiveShadow />
      <mesh geometry={geo.runoffR} material={mats.runoff} receiveShadow />
      <mesh geometry={geo.lineL} material={mats.paint} receiveShadow />
      <mesh geometry={geo.lineR} material={mats.paint} receiveShadow />
      {geo.kerbs && <mesh geometry={geo.kerbs} material={mats.kerb} receiveShadow castShadow />}
      <mesh geometry={geo.walls} material={mats.wall} receiveShadow castShadow />
      <StartLine track={track} paint={mats.paint} />
    </group>
  );
}
