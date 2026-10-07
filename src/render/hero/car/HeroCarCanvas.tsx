'use client';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { InputSpec } from '@/engine/env/types';
import type { Track } from '@/engine/racing/track/types';
import type { QualityTier } from '@/features/racing/state/labStore';
import { ChampionCar } from '@/render/racing/ChampionCar';
import { RacingEffects } from '@/render/racing/post/RacingEffects';
import { RacingWorld } from '@/render/racing/RacingWorld';
import { createFrame, RacingSceneContext } from '@/render/racing/sceneContext';
import { TireEffects } from '@/render/racing/TireEffects';
import { FramePacer } from '@/render/shared/FramePacer';
import { Prewarm } from '@/render/shared/Prewarm';
import { useFrameLoop } from '@/render/shared/frameLoop';
import { tierDpr } from '@/render/shared/quality';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { HeroCarDriver } from './HeroCarDriver';
import { HeroCarRays } from './HeroCarRays';
import { HeroChaseCamera } from './HeroChaseCamera';

interface Props {
  track: Track;
  /** The hero car, streamed by the replay worker as a ghost. */
  stream: SnapshotStream;
  schema: InputSpec[];
  tier: QualityTier;
  /** False while the scene is faded out or off screen: the canvas then draws nothing. */
  running: boolean;
  /** Called once the scene can draw without stalling the page (see Prewarm). */
  onShown: () => void;
}

/**
 * The racing half of the landing hero: the lab's own track, scenery,
 * sky and hypercar, with one trained car driving and its rays drawn from
 * its live inputs. It only reads the stream, like the lab viewport.
 */
export function HeroCarCanvas({ track, stream, schema, tier, running, onShown }: Props) {
  const loop = useFrameLoop(running ? 'live' : 'held');
  const frame = useMemo(() => createFrame(), []);
  const target = useRef(new THREE.Vector3());
  const value = useMemo(() => ({ track, population: null, ghosts: stream, frame }), [track, stream, frame]);
  const [warm, setWarm] = useState(false);
  const isReady = useCallback(() => stream.curr !== null, [stream]);
  const onWarm = useCallback(() => {
    setWarm(true);
    onShown();
  }, [onShown]);

  return (
    <Canvas
      shadows={tier !== 'low'}
      dpr={tierDpr(tier)}
      gl={{ antialias: tier === 'medium', powerPreference: 'high-performance', toneMapping: tier === 'high' ? THREE.NoToneMapping : THREE.ACESFilmicToneMapping }}
      camera={{ fov: 42, near: 0.5, far: 6000, position: [0, 60, 80] }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
        gl.toneMappingExposure = 0.92;
      }}
      frameloop={loop.frameloop}
    >
      <FramePacer loop={loop} />
      <RacingSceneContext.Provider value={value}>
        <Prewarm isReady={isReady} stepping={!running} onWarm={onWarm} />
        <HeroCarDriver />
        <RacingWorld track={track} tier={tier} focus={target} />
        <ChampionCar tier={tier} ring={false} />
        {tier !== 'low' && <TireEffects />}
        <HeroCarRays schema={schema} />
        <HeroChaseCamera target={target} />
        {/* The composer draws on its own, so it joins once everything else has compiled. */}
        {warm && <RacingEffects tier={tier} chase={false} />}
      </RacingSceneContext.Provider>
    </Canvas>
  );
}
