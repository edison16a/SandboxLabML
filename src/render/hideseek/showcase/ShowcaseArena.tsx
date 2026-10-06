'use client';

import * as THREE from 'three';
import { useFrame, type ThreeEvent } from '@react-three/fiber';
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
import { ShowcaseAgent, useAgentGeometry } from './ShowcaseAgent';
import { ShowcaseBoxes } from './ShowcaseBoxes';
import { SightLines } from './SightLines';
import { VisionCone } from './VisionCone';

const SIZE = DEFAULT_HIDESEEK_PHYSICS.arena.size;

/**
 * One arena in full quality, mounted at the focused slot's place in the
 * grid: textured room, rounded crates with lock animation, detailed agents,
 * the clipped vision cone, sight lines and the SEEN billboard. It follows
 * the frame every tick; React only re-renders when the arena or layout it
 * shows changes.
 */
export function ShowcaseArena({ tier, sandbox }: { tier: HsQualityTier; sandbox: boolean }) {
  const { frame, onMoveBox, onToggleLock } = useHsScene();
  const group = useRef<THREE.Group>(null);
  const [shown, setShown] = useState<{ arena: number; layout: number } | null>(null);
  const origin = useMemo(() => ({ x: 0, z: 0 }), []);
  const agentGeometry = useAgentGeometry();
  const getOrigin = useCallback(() => origin, [origin]);
  const drag = useBoxDrag(getOrigin, sandbox ? onMoveBox : undefined);
  const onBox = useCallback(
    (index: number, e: ThreeEvent<PointerEvent>) => {
      // A double press on a crate locks or frees it; a single press drags it.
      if (sandbox && e.nativeEvent.detail >= 2 && frame.curr && onToggleLock) {
        e.stopPropagation();
        onToggleLock(index, frame.curr[boxAt(frame.first + Math.max(0, frame.focusSlot), index) + 3] !== 1);
        return;
      }
      drag(index, e);
    },
    [sandbox, frame, onToggleLock, drag],
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
          <ArenaRoom layout={shown.layout} />
          <ShowcaseBoxes arena={shown.arena} onBoxPointerDown={sandbox ? onBox : undefined} />
          <ShowcaseAgent arena={shown.arena} agent={0} geometry={agentGeometry} />
          <ShowcaseAgent arena={shown.arena} agent={1} geometry={agentGeometry} />
          <VisionCone arena={shown.arena} layout={shown.layout} />
          <SightLines arena={shown.arena} layout={shown.layout} />
          <Suspense fallback={null}>
            <SeenBillboard arena={shown.arena} />
          </Suspense>
          {tier !== 'low' && (
            <ContactShadows position={[0, 0.006, 0]} scale={SIZE} resolution={tier === 'ultra' ? 1024 : 512} far={1.8} blur={2.6} opacity={0.62} color="#05070b" frames={Infinity} />
          )}
        </>
      )}
    </group>
  );
}
