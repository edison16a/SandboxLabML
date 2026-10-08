'use client';

import type * as THREE from 'three';
import { useCallback, useMemo } from 'react';
import type { InputSpec } from '@/engine/env/types';
import type { SandboxRoom } from '@/engine/hideseek/sandbox/room';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import { createHsFrame, HsSceneContext } from '@/render/hideseek/frame/sceneContext';
import { HS_TONE_MAPPING } from '@/render/hideseek/palette';
import { SandboxArena } from '@/render/hideseek/sandbox/SandboxArena';
import { Backdrop } from '@/render/hideseek/scene/Backdrop';
import { StudioLighting } from '@/render/hideseek/scene/StudioLighting';
import { Prewarm } from '@/render/shared/Prewarm';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import type { PaneView } from '../stage/paneView';
import type { Tone } from '../stage/SplitRenderer';
import { HeroArenaCamera } from './HeroArenaCamera';
import { HeroArenaDriver } from './HeroArenaDriver';

/**
 * The lab's tone curve, a little brighter. No scrim covers the scene any
 * more, but the room sits beside the racing scene's sunlit hills, and at
 * the lab's exposure its white floor read grey next to them.
 */
export const ARENA_TONE: Tone = { mapping: HS_TONE_MAPPING, exposure: 1.15 };
/** Brightness of the city blocks and the ground between them against the lab's, so the room stands out from its city. */
const CITY_SHADE = 0.6;

const prepareTone = (gl: THREE.WebGLRenderer) => {
  gl.toneMapping = ARENA_TONE.mapping;
  gl.toneMappingExposure = ARENA_TONE.exposure;
};

/** The hero draws no input overlay, so neither team needs its input schema. */
const NO_SCHEMAS: [InputSpec[], InputSpec[]] = [[], []];

interface Props {
  room: SandboxRoom;
  /** The match, streamed by the replay worker as a Sandbox match. */
  stream: SnapshotStream;
  tier: HsQualityTier;
  pane: PaneView;
  /** Step the scene by hand while it warms up: the canvas is held. */
  stepping: boolean;
  /** Called once the scene can draw without stalling the page (see Prewarm). */
  onWarm: () => void;
}

/**
 * The Hide and Seek half of the landing hero: the lab's Sandbox arena,
 * lighting and city backdrop, with reference champions playing a real
 * match in the replay worker. Nothing here can be dragged or locked; the
 * page only watches. It lives in a portal of the hero's one canvas.
 */
export function HeroArenaScene({ room, stream, tier, pane, stepping, onWarm }: Props) {
  const frame = useMemo(() => createHsFrame(), []);
  const getFeed = useCallback(() => stream, [stream]);
  const value = useMemo(() => ({ frame, getFeed, schemas: NO_SCHEMAS }), [frame, getFeed]);
  const isReady = useCallback(() => frame.curr !== null && !frame.preview, [frame]);

  return (
    <HsSceneContext.Provider value={value}>
      <Prewarm isReady={isReady} stepping={stepping} onWarm={onWarm} prepare={prepareTone} />
      <HeroArenaDriver />
      <StudioLighting tier={tier} shadows={tier !== 'low'} />
      <Backdrop shade={CITY_SHADE} />
      <SandboxArena tier={tier} aoPass={false} room={room} />
      <HeroArenaCamera pane={pane} />
    </HsSceneContext.Provider>
  );
}
