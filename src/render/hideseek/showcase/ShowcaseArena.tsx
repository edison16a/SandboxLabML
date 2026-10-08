'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import { useHsScene } from '../frame/sceneContext';
import { SceneField } from '../frame/sceneField';
import { wallsOfLayout } from '../layout/arenaWalls';
import { arenaOrigin } from '../layout/gridLattice';
import { ArenaContactShadows } from './ArenaContactShadows';
import { ArenaRoom } from './ArenaRoom';
import { SeenBillboard } from './SeenBillboard';
import { ShowcaseAgent } from './ShowcaseAgent';
import { ShowcaseBoxes } from './ShowcaseBoxes';
import { SightLines } from './SightLines';
import { VisionCone } from './VisionCone';

/**
 * One arena in full quality, mounted at the focused slot's place in the
 * grid: textured room, rounded crates with lock animation, detailed agents,
 * the clipped vision cone, sight lines and the SEEN billboard. It follows
 * the frame every tick; React only re-renders when the arena or layout it
 * shows changes.
 */
export function ShowcaseArena({ tier, aoPass }: { tier: HsQualityTier; /** N8AO runs over the frame, so the baked wall foot shade can be lighter. */ aoPass: boolean }) {
  const { frame } = useHsScene();
  const group = useRef<THREE.Group>(null);
  const [shown, setShown] = useState<{ arena: number; layout: number } | null>(null);
  const origin = useMemo(() => ({ x: 0, z: 0 }), []);
  const field = useMemo(() => new SceneField(), []);

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    if (frame.focusSlot < 0) {
      g.visible = false;
      if (frame.field === field) frame.field = null;
      return;
    }
    const arena = frame.first + frame.focusSlot;
    const layout = frame.layouts[frame.focusSlot] ?? 0;
    if (!shown || shown.arena !== arena || shown.layout !== layout) setShown({ arena, layout });
    field.readArena(frame, arena);
    field.walls = frame.walls = wallsOfLayout(layout);
    frame.field = field;
    arenaOrigin(frame.focusSlot, frame.lattice, origin);
    g.position.set(origin.x, 0, origin.z);
    g.visible = true;
  }, -1);
  useEffect(
    () => () => {
      if (frame.field === field) frame.field = null;
    },
    [frame, field],
  );

  return (
    <group ref={group} visible={false}>
      {shown && (
        <>
          <ArenaRoom layout={shown.layout} ao={aoPass ? 0.3 : 0.5} />
          <ShowcaseBoxes arena={shown.arena} tier={tier} />
          <ShowcaseAgent arena={shown.arena} agent={0} tier={tier} field={field} />
          <ShowcaseAgent arena={shown.arena} agent={1} tier={tier} field={field} />
          <VisionCone arena={shown.arena} layout={shown.layout} />
          <SightLines arena={shown.arena} layout={shown.layout} />
          <Suspense fallback={null}>
            <SeenBillboard arena={shown.arena} />
          </Suspense>
          <ArenaContactShadows tier={tier} />
        </>
      )}
    </group>
  );
}
