'use client';

import { useEffect, useState } from 'react';
import { loadReferences } from '@/engine/bench/references';
import type { ReferenceChampion } from '@/engine/bench/types';
import type { InputSpec } from '@/engine/env/types';
import { base64ToBytes, decodeGenome } from '@/engine/neat/serialize';
import type { Genome } from '@/engine/neat/types';
import { racingInputSchema } from '@/engine/racing/sensors/inputSchema';
import { buildTrack } from '@/engine/racing/track/buildTrack';
import type { Track } from '@/engine/racing/track/types';
import { pickShowcasePair } from '@/engine/showcase/arena';
import { HERO_RACER_PATH, parseHeroRacer, type HeroRacer } from '@/engine/showcase/racer';
import { createShowcasePool, type ShowcasePool } from '@/workers/client/showcasePool';

/** Ticks the car drives before the hero shows it, so it opens at speed rather than on the grid. 9 s at 30 ticks a second. */
const WARMUP_TICKS = 270;
/** How long the arena waits for a loaded car to reach the screen before it starts anyway, ms. */
const ARENA_FALLBACK_MS = 10_000;

export interface CarShowcase {
  racer: HeroRacer;
  track: Track;
  schema: InputSpec[];
}

export interface ArenaShowcase {
  pair: ReferenceChampion;
  hider: Genome;
  seeker: Genome;
}

export interface Showcase {
  pool: ShowcasePool | null;
  car: CarShowcase | null;
  arena: ArenaShowcase | null;
}

async function fetchJson(path: string): Promise<unknown> {
  const res = await fetch(path);
  return res.ok ? res.json() : null;
}

/** Plays the hero car in the worker and returns what the page needs to draw it, or null when the file is missing or stale. */
async function startCar(pool: ShowcasePool, data: unknown): Promise<CarShowcase | null> {
  const racer = parseHeroRacer(data);
  if (!racer) return null;
  const ghost = { generation: racer.file.generation, genome: racer.genome, seed: racer.file.replaySeed, scriptSource: null, slot: 0 };
  await pool.replay.setGhostScene(racer.setup, [ghost]);
  pool.car.subscribe(0, false);
  await pool.replay.playGhosts(1, true, WARMUP_TICKS);
  return { racer, track: buildTrack(racer.setup.track), schema: racingInputSchema(racer.setup.inputs, racer.setup.car) };
}

/** Fetches the Hide and Seek references and decodes the pair the hero shows, or null when there is none. */
async function loadArena(): Promise<ArenaShowcase | null> {
  const refs = await loadReferences('hideseek');
  const pair = refs?.champions ? pickShowcasePair(refs.champions) : null;
  if (!pair) return null;
  return { pair, hider: decodeGenome(base64ToBytes(pair.hider.genome)), seeker: decodeGenome(base64ToBytes(pair.seeker.genome)) };
}

/**
 * Starts the hero's replay worker and loads both scenes into it. The car
 * comes first. The Hide and Seek half (its references, its physics engine
 * and its 3D scene) only starts once the car is on screen, so its warm up
 * never competes with the car's, or once the car has failed or taken too
 * long. Either half may fail on its own (an old file, a blocked fetch), and
 * the hero then shows what did load, or keeps its poster. The worker goes
 * when the hero unmounts.
 */
export function useShowcase(carShown: boolean): Showcase {
  const [state, setState] = useState<Showcase>({ pool: null, car: null, arena: null });
  const [carFailed, setCarFailed] = useState(false);
  const [waited, setWaited] = useState(false);

  useEffect(() => {
    let gone = false;
    let pool: ShowcasePool | null = null;
    void (async () => {
      const [made, racerData] = await Promise.all([createShowcasePool(), fetchJson(HERO_RACER_PATH).catch(() => null)]);
      if (gone) return made.terminate();
      pool = made;
      setState((s) => ({ ...s, pool: made }));
      const car = await startCar(made, racerData).catch(() => null);
      if (gone) return;
      if (car) setState((s) => ({ ...s, car }));
      else setCarFailed(true);
    })().catch(() => {
      // A hero whose worker cannot start keeps its poster. Nothing else on the page depends on it.
    });
    return () => {
      gone = true;
      pool?.terminate();
    };
  }, []);

  // A car that loaded but never reaches the screen (say its WebGL context was refused) hands over to the arena.
  const carLoaded = state.car !== null;
  useEffect(() => {
    if (!carLoaded || carShown) return;
    const timer = setTimeout(() => setWaited(true), ARENA_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [carLoaded, carShown]);

  const arenaGo = state.pool !== null && (carShown || carFailed || waited);
  useEffect(() => {
    if (!arenaGo) return;
    let gone = false;
    loadArena().then(
      (arena) => !gone && arena && setState((s) => ({ ...s, arena })),
      () => {
        // No references, no arena: the car keeps the hero on its own.
      },
    );
    return () => {
      gone = true;
    };
  }, [arenaGo]);

  return state;
}
