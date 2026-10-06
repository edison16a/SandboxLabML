'use client';

import { useFrame, useThree } from '@react-three/fiber';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { sandboxBoxAt, sandboxBoxCount, sandboxHiderCount, sandboxSeekerCount } from '@/engine/hideseek/sandbox/snapshot';
import { DEFAULT_HIDESEEK_PHYSICS, type BoxKind } from '@/engine/hideseek/physics';
import { roomWallRects } from '@/engine/hideseek/sandbox/room';
import type { HsQualityTier } from '@/features/hideseek/state/types';
import { useHsScene } from '../frame/sceneContext';
import { useBoxDrag } from '../interaction/useBoxDrag';
import { ArenaContactShadows } from '../showcase/ArenaContactShadows';
import { RoomMesh } from '../showcase/ArenaRoom';
import { useAgentGeometry } from '../showcase/ShowcaseAgent';
import { SandboxAgent } from './SandboxAgent';
import { SandboxBoxes } from './SandboxBoxes';
import { SandboxCones } from './SandboxCones';
import { isLocked, isPlank, readPlayer, sandboxFrame, sandboxPlayerCount } from './sandboxRead';
import { useSandboxRoom } from './useSandboxRoom';
import { SeenMarkers } from './SeenMarkers';

const P = DEFAULT_HIDESEEK_PHYSICS;

/** What is on the field, published with the render stats for tests. */
export const sandboxStats = { agents: 0, boxes: 0, locked: 0 };

interface Shape {
  hiders: number;
  seekers: number;
  kinds: BoxKind[];
}

const kindOf = (bits: number): BoxKind => (isPlank(bits) ? 'plank' : 'cube');

/** Whether a frame still has the players and box kinds React last drew. Checked every frame, so it allocates nothing. */
function sameShape(shape: Shape | null, curr: Float32Array): boolean {
  if (!shape || shape.hiders !== sandboxHiderCount(curr) || shape.seekers !== sandboxSeekerCount(curr) || shape.kinds.length !== sandboxBoxCount(curr)) return false;
  const players = shape.hiders + shape.seekers;
  for (let b = 0; b < shape.kinds.length; b++) if (kindOf(curr[sandboxBoxAt(players, b) + 3]) !== shape.kinds[b]) return false;
  return true;
}

/**
 * The Sandbox match in full quality: the room as built (preset or drawn),
 * every player, every box with drag to move and double click to lock, a
 * vision cone per seeker and SEEN over each hider in sight. Players and
 * boxes come from the Sandbox stream, whose header says how many there
 * are; React re-renders only when those counts or the room change.
 */
export function SandboxArena({ tier, aoPass }: { tier: HsQualityTier; /** N8AO runs over the frame, so the baked wall foot shade can be lighter. */ aoPass: boolean }) {
  const { frame, getFeed, onMoveBox, onToggleLock } = useHsScene();
  const invalidate = useThree((s) => s.invalidate);
  const room = useSandboxRoom();
  const walls = useMemo(() => roomWallRects(room, P), [room]);
  const wallsKey = useMemo(() => JSON.stringify(room.walls), [room]);
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
      onToggleLock(index, !isLocked(curr[sandboxBoxAt(sandboxPlayerCount(curr), index) + 3]));
    },
    [frame, onToggleLock],
  );

  useFrame(() => {
    const curr = sandboxFrame(frame);
    if (!curr) return;
    const players = sandboxPlayerCount(curr);
    const boxes = sandboxBoxCount(curr);
    // A new shape is built only when the players or boxes change, which is when React must re-render.
    if (!sameShape(shape, curr)) {
      const kinds = Array.from({ length: boxes }, (_, b) => kindOf(curr[sandboxBoxAt(players, b) + 3]));
      setShape({ hiders: sandboxHiderCount(curr), seekers: sandboxSeekerCount(curr), kinds });
    }
    let locked = 0;
    for (let b = 0; b < boxes; b++) if (isLocked(curr[sandboxBoxAt(players, b) + 3])) locked++;
    sandboxStats.agents = players;
    sandboxStats.boxes = boxes;
    sandboxStats.locked = locked;
  }, -1);

  useEffect(() => {
    // First person cameras and the inputs overlay follow the first player of each team.
    frame.agentPose = (agent, out) => {
      const curr = sandboxFrame(frame);
      if (!curr) return -1;
      const hiders = sandboxHiderCount(curr);
      if (agent === 0 ? hiders === 0 : sandboxSeekerCount(curr) === 0) return -1;
      return readPlayer(frame, curr, agent === 0 ? 0 : hiders, out);
    };
    // While paused the canvas draws on demand: a box dragged or locked must still show.
    const off = getFeed()?.on(() => invalidate());
    return () => {
      frame.agentPose = null;
      off?.();
      Object.assign(sandboxStats, { agents: 0, boxes: 0, locked: 0 });
    };
  }, [frame, getFeed, invalidate]);

  return (
    <group>
      <RoomMesh walls={walls} wallsKey={wallsKey} ao={aoPass ? 0.3 : 0.5} />
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
      <ArenaContactShadows tier={tier} />
    </group>
  );
}
