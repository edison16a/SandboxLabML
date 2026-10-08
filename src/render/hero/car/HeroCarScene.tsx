'use client';

import * as THREE from 'three';
import { useCallback, useMemo, useRef } from 'react';
import type { InputSpec } from '@/engine/env/types';
import type { Track } from '@/engine/racing/track/types';
import type { QualityTier } from '@/features/racing/state/labStore';
import { ChampionCar } from '@/render/racing/ChampionCar';
import { RacingWorld } from '@/render/racing/RacingWorld';
import { createFrame, RacingSceneContext } from '@/render/racing/sceneContext';
import { TireEffects } from '@/render/racing/TireEffects';
import { TERRAIN_STEP } from '@/render/racing/world/terrain/Terrain';
import { useWorld } from '@/render/racing/world/useWorld';
import { readTerrain } from '@/render/racing/world/worldStore';
import { Prewarm } from '@/render/shared/Prewarm';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import type { PaneView } from '../stage/paneView';
import type { Tone } from '../stage/SplitRenderer';
import { HeroCarDriver } from './HeroCarDriver';
import { HeroCarRays } from './HeroCarRays';
import { HeroChaseCamera } from './HeroChaseCamera';
import { installHeroGrade } from './heroGrade';

installHeroGrade();

/**
 * ACES at the lab's exposure with the lab's High grade baked in (see
 * heroGrade). The hero has no effect composer, so this is how its racing
 * pane gets the lab's warm, rich look, on every tier.
 */
export const CAR_TONE: Tone = { mapping: THREE.CustomToneMapping, exposure: 0.92 };

const prepareTone = (gl: THREE.WebGLRenderer) => {
  gl.toneMapping = CAR_TONE.mapping;
  gl.toneMappingExposure = CAR_TONE.exposure;
};

interface Props {
  track: Track;
  /** The hero car, streamed by the replay worker as a ghost. */
  stream: SnapshotStream;
  schema: InputSpec[];
  tier: QualityTier;
  pane: PaneView;
  /** Step the scene by hand while it warms up: the canvas is held. */
  stepping: boolean;
  /** Called once the scene can draw without stalling the page (see Prewarm). */
  onWarm: () => void;
}

/**
 * The racing half of the landing hero: the lab's own track, scenery,
 * sky and hypercar, with one trained car driving and its rays drawn from
 * its live inputs. It only reads the stream, like the lab viewport. It
 * lives in a portal of the hero's one canvas (see HeroStage).
 */
export function HeroCarScene({ track, stream, schema, tier, pane, stepping, onWarm }: Props) {
  const frame = useMemo(() => createFrame(), []);
  const target = useRef(new THREE.Vector3());
  const value = useMemo(() => ({ track, population: null, ghosts: stream, frame }), [track, stream, frame]);
  // The hills and trees are built in a worker; the scene only shows once they and the car's first frame are in.
  const world = useWorld(track, TERRAIN_STEP[tier]);
  const isReady = useCallback(() => stream.curr !== null && world !== null && readTerrain(world, TERRAIN_STEP[tier]) !== null, [stream, world, tier]);

  return (
    <RacingSceneContext.Provider value={value}>
      <Prewarm isReady={isReady} stepping={stepping} onWarm={onWarm} prepare={prepareTone} />
      <HeroCarDriver />
      <RacingWorld track={track} tier={tier} focus={target} />
      <ChampionCar tier={tier} ring={false} />
      {tier !== 'low' && <TireEffects />}
      <HeroCarRays schema={schema} />
      <HeroChaseCamera target={target} pane={pane} />
    </RacingSceneContext.Provider>
  );
}
