'use client';

import { useEffect, useMemo, useState } from 'react';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { presetRoom, type SandboxRoom } from '@/engine/hideseek/sandbox/room';
import { SANDBOX_OVER, SANDBOX_PHASE, SANDBOX_TIME } from '@/engine/hideseek/sandbox/snapshot';
import { showcaseMatch, SHOWCASE_PLAYERS } from '@/engine/showcase/arena';
import type { ShowcasePool } from '@/workers/client/showcasePool';
import type { ArenaShowcase } from './useShowcase';

/** How long a finished match stays on screen before the next one starts, ms. */
const OVER_PAUSE_MS = 2500;

/** What the page shows about the match in play. */
export interface ArenaMatchState {
  room: SandboxRoom | null;
  /** True while hiders hide and seekers are asleep. */
  prep: boolean;
  /** Whole seconds left in the current phase. */
  left: number;
}

/**
 * Plays hero matches one after another in the replay worker: the shown
 * pair, two of each, in rooms that take turns. It runs only while
 * `playing`, so a hidden scene costs nothing, and follows the match clock
 * from the stream so the page can say what is happening.
 */
export function useArenaMatch(pool: ShowcasePool | null, arena: ArenaShowcase | null, playing: boolean): ArenaMatchState {
  const [n, setN] = useState(0);
  // The room goes to the renderer only once the worker plays in it, so walls and players never disagree.
  const [loaded, setLoaded] = useState<{ n: number; room: SandboxRoom } | null>(null);
  const [clock, setClock] = useState({ prep: true, left: 0 });
  const match = useMemo(() => showcaseMatch(n), [n]);
  const room = useMemo(() => presetRoom(match.room), [match.room]);

  useEffect(() => {
    if (!pool || !arena) return;
    let gone = false;
    const side = (genome: ArenaShowcase['hider'], inputs: ArenaShowcase['pair']['hider']['inputs']) => ({ genome, inputs, count: SHOWCASE_PLAYERS });
    // The references are rated under the standard physics (see HS_BENCH_PHYSICS), so they play under it here too.
    const scene = { room, hider: side(arena.hider, arena.pair.hider.inputs), seeker: side(arena.seeker, arena.pair.seeker.inputs), seed: match.seed, physics: DEFAULT_HIDESEEK_PHYSICS, scriptSource: null };
    pool.replay.loadSandbox(scene).then(
      () => !gone && setLoaded({ n, room }),
      () => {
        // A match that cannot load leaves the arena scene unready, and the car keeps the hero.
      },
    );
    return () => {
      gone = true;
    };
  }, [pool, arena, room, match.seed, n]);

  useEffect(() => {
    if (pool && loaded?.n === n) void pool.replay.setSandboxPaused(!playing);
  }, [pool, playing, loaded, n]);

  useEffect(() => {
    if (!pool) return;
    let next: ReturnType<typeof setTimeout> | null = null;
    const physics = DEFAULT_HIDESEEK_PHYSICS;
    const prepEnds = physics.matchSeconds * physics.prepShare;
    const off = pool.arena.on((msg) => {
      const buf = pool.arena.curr?.buffer;
      if (msg.kind !== 'frame' || !buf) return;
      const prep = buf[SANDBOX_PHASE] === 1;
      const t = buf[SANDBOX_TIME];
      const left = Math.max(0, Math.ceil((prep ? prepEnds : physics.matchSeconds) - t));
      setClock((c) => (c.prep === prep && c.left === left ? c : { prep, left }));
      if (buf[SANDBOX_OVER] === 1 && !next) next = setTimeout(() => setN((k) => k + 1), OVER_PAUSE_MS);
    });
    return () => {
      off();
      if (next) clearTimeout(next);
    };
  }, [pool, n]);

  return { room: loaded?.room ?? null, prep: clock.prep, left: clock.left };
}
