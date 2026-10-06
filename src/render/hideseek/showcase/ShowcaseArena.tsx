'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { Suspense, useCallback, useMemo, useRef, useState } from 'react';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import { useHsScene } from '../frame/sceneContext';
import { boxAt } from '../frame/snapshotRead';
import { useBoxDrag } from '../interaction/useBoxDrag';
import { arenaOrigin } from '../layout/gridLattice';
import { ArenaRoom } from './ArenaRoom';
import { SeenBillboard } from './SeenBillboard';
import { ShowcaseAgent } from './ShowcaseAgent';
import { ShowcaseBoxes } from './ShowcaseBoxes';
import { SightLines } from './SightLines';
import { VisionCone } from './VisionCone';

const SIZE = DEFAULT_HIDESEEK_PHYSICS.arena.size;

/**
 * Contact shadows look up from their plane and darken whatever they see
 * close above it. Crates and agents stand exactly on the floor, so from a
 * camera at plane height their bottom faces sit right on the near plane
 * and their sides are seen edge on: the shadow comes out empty. Dropping
 * the shadow camera a few centimeters below the floor, while the shadow
 * itself stays drawn just above it, lets the camera see those bottoms.
 * The group is turned a quarter turn about x, so its local +z points down.
 */
function lowerShadowCamera(group: THREE.Group | null): void {
  const camera = group?.children.find((c) => (c as THREE.OrthographicCamera).isOrthographicCamera);
  if (camera) camera.position.z = 0.03;
}

/**
 * One arena in full quality, mounted at the focused slot's place in the
 * grid: textured room, rounded crates with lock animation, detailed agents,
 * the clipped vision cone, sight lines and the SEEN billboard. It follows
 * the frame every tick; React only re-renders when the arena or layout it
 * shows changes.
 */
export function ShowcaseArena({ tier, sandbox, aoPass }: { tier: HsQualityTier; sandbox: boolean; /** N8AO runs over the frame, so the baked wall foot shade can be lighter. */ aoPass: boolean }) {
  const { frame, onMoveBox, onToggleLock } = useHsScene();
  const group = useRef<THREE.Group>(null);
  const [shown, setShown] = useState<{ arena: number; layout: number } | null>(null);
  const origin = useMemo(() => ({ x: 0, z: 0 }), []);
  const getOrigin = useCallback(() => origin, [origin]);
  const drag = useBoxDrag(getOrigin, sandbox ? onMoveBox : undefined);
  /** A double click on a crate locks or frees it; a press and drag moves it. */
  const toggleLock = useCallback(
    (index: number) => {
      if (!frame.curr || !onToggleLock) return;
      onToggleLock(index, frame.curr[boxAt(frame.first + Math.max(0, frame.focusSlot), index) + 3] !== 1);
    },
    [frame, onToggleLock],
  );

  useFrame(() => {
    const g = group.current;
    if (!g) return;
    if (frame.focusSlot < 0) {
      g.visible = false;
      return;
    }
    const arena = frame.first + frame.focusSlot;
    const layout = frame.layouts[frame.focusSlot] ?? 0;
    if (!shown || shown.arena !== arena || shown.layout !== layout) setShown({ arena, layout });
    arenaOrigin(frame.focusSlot, frame.lattice, origin);
    g.position.set(origin.x, 0, origin.z);
    g.visible = true;
  }, -1);

  return (
    <group ref={group} visible={false}>
      {shown && (
        <>
          <ArenaRoom layout={shown.layout} ao={aoPass ? 0.3 : 0.5} />
          <ShowcaseBoxes arena={shown.arena} tier={tier} onBoxPointerDown={sandbox ? drag : undefined} onBoxDoubleClick={sandbox ? toggleLock : undefined} />
          <ShowcaseAgent arena={shown.arena} agent={0} tier={tier} />
          <ShowcaseAgent arena={shown.arena} agent={1} tier={tier} />
          <VisionCone arena={shown.arena} layout={shown.layout} />
          <SightLines arena={shown.arena} layout={shown.layout} />
          <Suspense fallback={null}>
            <SeenBillboard arena={shown.arena} />
          </Suspense>
          {tier !== 'low' && (
            <ContactShadows ref={lowerShadowCamera} position={[0, 0.004, 0]} scale={SIZE} resolution={tier === 'ultra' ? 1024 : 512} far={1.8} blur={2.2} opacity={0.5} color="#2a2219" frames={Infinity} />
          )}
        </>
      )}
    </group>
  );
}
