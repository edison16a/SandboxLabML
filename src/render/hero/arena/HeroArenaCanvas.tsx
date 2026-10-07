'use client';

import * as THREE from 'three';
import { Canvas } from '@react-three/fiber';
import { useCallback, useMemo, useState } from 'react';
import type { InputSpec } from '@/engine/env/types';
import type { SandboxRoom } from '@/engine/hideseek/sandbox/room';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import { createHsFrame, HsSceneContext } from '@/render/hideseek/frame/sceneContext';
import { SandboxArena } from '@/render/hideseek/sandbox/SandboxArena';
import { Backdrop } from '@/render/hideseek/scene/Backdrop';
import { tierDpr, ToneMappingSync } from '@/render/hideseek/scene/RenderHelpers';
import { StudioLighting } from '@/render/hideseek/scene/StudioLighting';
import { ShowcaseEffects } from '@/render/hideseek/showcase/ShowcaseEffects';
import { FramePacer } from '@/render/shared/FramePacer';
import { Prewarm } from '@/render/shared/Prewarm';
import { useFrameLoop } from '@/render/shared/frameLoop';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { HeroArenaDriver } from './HeroArenaDriver';
import { HeroArenaCamera } from './HeroArenaCamera';

interface Props {
  room: SandboxRoom;
  /** The match, streamed by the replay worker as a Sandbox match. */
  stream: SnapshotStream;
  tier: HsQualityTier;
  /** False while the scene is faded out or off screen: the canvas then draws nothing. */
  running: boolean;
  /** Called once the scene can draw without stalling the page (see Prewarm). */
  onShown: () => void;
}

/**
 * The page text sits over this scene, under a dark scrim. Only the city
 * is darkened (see CITY_SHADE), which gives the headline a dark field; the
 * room itself is drawn a little brighter than in the lab, so under the
 * scrim the gold crates stay gold and the players keep their blue and red.
 */
const EXPOSURE = 1.05;
/** Brightness of the city blocks and the ground between them against the lab's. */
const CITY_SHADE = 0.55;

/** The hero draws no input overlay, so neither team needs its input schema. */
const NO_SCHEMAS: [InputSpec[], InputSpec[]] = [[], []];

/**
 * The Hide and Seek half of the landing hero: the lab's Sandbox arena,
 * lighting, city backdrop and post effects, with reference champions
 * playing a real match in the replay worker. Nothing here can be
 * dragged or locked; the page only watches.
 */
export function HeroArenaCanvas({ room, stream, tier, running, onShown }: Props) {
  const loop = useFrameLoop(running ? 'live' : 'held');
  const frame = useMemo(() => createHsFrame(), []);
  const getFeed = useCallback(() => stream, [stream]);
  const value = useMemo(() => ({ frame, getFeed, schemas: NO_SCHEMAS }), [frame, getFeed]);
  const [warm, setWarm] = useState(false);
  // The composer draws on its own, so it joins once everything else has compiled.
  const composer = warm && (tier === 'high' || tier === 'ultra');
  const isReady = useCallback(() => frame.curr !== null && !frame.preview, [frame]);
  const onWarm = useCallback(() => {
    setWarm(true);
    onShown();
  }, [onShown]);

  return (
    <Canvas
      shadows={{ enabled: tier !== 'low', type: THREE.PCFShadowMap }}
      dpr={tierDpr(tier)}
      frameloop={loop.frameloop}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      camera={{ fov: 38, near: 0.1, far: 2500, position: [0, 30, 30] }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <FramePacer loop={loop} />
      <HsSceneContext.Provider value={value}>
        <Prewarm isReady={isReady} stepping={!running} onWarm={onWarm} />
        <HeroArenaDriver />
        <ToneMappingSync composer={composer} exposure={EXPOSURE} />
        <StudioLighting tier={tier} shadows={tier !== 'low'} />
        <Backdrop shade={CITY_SHADE} />
        <SandboxArena tier={tier} aoPass={composer} room={room} />
        <HeroArenaCamera />
        {composer && <ShowcaseEffects tier={tier} photo={false} />}
      </HsSceneContext.Provider>
    </Canvas>
  );
}
