'use client';

import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { BOX_PLANK, sandboxBoxAt, sandboxCounts } from '@/engine/hideseek/sandbox/snapshot';
import { DEFAULT_HIDESEEK_PHYSICS, type BoxKind } from '@/engine/hideseek/physics';
import { roomWallRects } from '@/engine/hideseek/sandbox/room';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import { useHsScene } from '../frame/sceneContext';
import { useBoxDrag } from '../interaction/useBoxDrag';
import { useAgentGeometry } from '../showcase/ShowcaseAgent';
import { SandboxAgent } from './SandboxAgent';
import { SandboxBoxes } from './SandboxBoxes';
import { SandboxCones } from './SandboxCones';
import { SandboxRoomMesh } from './SandboxRoomMesh';
import { isLocked, readPlayer, sandboxFrame } from './sandboxRead';
import { useSandboxRoom } from './useSandboxRoom';
import { SeenMarkers } from './SeenMarkers';

const P = DEFAULT_HIDESEEK_PHYSICS;

/** What is on the field, published with the render stats for tests. */
export const sandboxStats = { agents: 0, boxes: 0, walls: 0 };

interface Shape {
  hiders: number;
  seekers: number;
  kinds: BoxKind[];
}

/** Same as the showcase: drop the contact shadow camera below the floor so it sees crate and agent bottoms. */
function lowerShadowCamera(group: THREE.Group | null): void {
  const camera = group?.children.find((c) => (c as THREE.OrthographicCamera).isOrthographicCamera);
  if (camera) camera.position.z = 0.03;
}

/**
 * The Sandbox match in full quality: the room as built (preset or drawn),
 * every player, every box with drag to move and double click to lock, a
 * vision cone per seeker and SEEN over each hider in sight. Players and
 * boxes come from the Sandbox stream, whose header says how many there
 * are; React re-renders only when those counts or the room change.
 */
export function SandboxArena({ tier }: { tier: HsQualityTier }) {
  const { frame, getFeed, onMoveBox, onToggleLock } = useHsScene();
  const invalidate = useThree((s) => s.invalidate);
  const room = useSandboxRoom();
  const walls = useMemo(() => roomWallRects(room, P), [room]);
  const [shape, setShape] = useState<Shape | null>(null);
  const agentGeometry = useAgentGeometry();
  const origin = useMemo(() => ({ x: 0, z: 0 }), []);
  const getOrigin = useCallback(() => origin, [origin]);
  const drag = useBoxDrag(getOrigin, onMoveBox);
  const players = shape ? shape.hiders + shape.seekers : 0;

  const toggleLock = useCallback(
    (index: number) => {
      const curr = sandboxFrame(frame);
      if (!curr || !onToggleLock) return;
      const c = sandboxCounts(curr);
      onToggleLock(index, !isLocked(curr[sandboxBoxAt(c.hiders + c.seekers, index) + 3]));
    },
    [frame, onToggleLock],
  );

  useFrame(() => {
    const curr = sandboxFrame(frame);
    if (!curr) return;
    const c = sandboxCounts(curr);
    const kinds: BoxKind[] = [];
    for (let b = 0; b < c.boxes; b++) kinds.push(curr[sandboxBoxAt(c.hiders + c.seekers, b) + 3] & BOX_PLANK ? 'plank' : 'cube');
    if (!shape || shape.hiders !== c.hiders || shape.seekers !== c.seekers || shape.kinds.join() !== kinds.join()) setShape({ hiders: c.hiders, seekers: c.seekers, kinds });
    sandboxStats.agents = c.hiders + c.seekers;
    sandboxStats.boxes = c.boxes;
    sandboxStats.walls = room.walls.length;
  }, -1);

  useEffect(() => {
    // First person cameras and the inputs overlay follow the first player of each team.
    frame.agentPose = (agent, out) => {
      const curr = sandboxFrame(frame);
      if (!curr) return -1;
      const c = sandboxCounts(curr);
      if (agent === 0 ? c.hiders === 0 : c.seekers === 0) return -1;
      return readPlayer(frame, curr, agent === 0 ? 0 : c.hiders, out);
    };
    // While paused the canvas draws on demand: a box dragged or locked must still show.
    const off = getFeed()?.on(() => invalidate());
    return () => {
      frame.agentPose = null;
      off?.();
      Object.assign(sandboxStats, { agents: 0, boxes: 0, walls: 0 });
    };
  }, [frame, getFeed, invalidate]);

  return (
    <group>
      <SandboxRoomMesh walls={walls} wallsKey={JSON.stringify(room.walls)} />
      {shape && (
        <>
          <SandboxBoxes kinds={shape.kinds} players={players} onPointerDown={onMoveBox ? drag : undefined} onDoubleClick={onToggleLock ? toggleLock : undefined} />
          {Array.from({ length: players }, (_, slot) => (
            <SandboxAgent key={slot} slot={slot} team={slot < shape.hiders ? 0 : 1} geometry={agentGeometry} />
          ))}
          <SandboxCones first={shape.hiders} count={shape.seekers} walls={walls} />
          <SeenMarkers hiders={shape.hiders} />
        </>
      )}
      {tier !== 'low' && (
        <ContactShadows
          ref={lowerShadowCamera}
          position={[0, 0.004, 0]}
          scale={P.arena.size}
          resolution={tier === 'ultra' ? 1024 : 512}
          far={1.8}
          blur={2.2}
          opacity={0.7}
          color="#04060a"
          frames={Infinity}
        />
      )}
    </group>
  );
}
