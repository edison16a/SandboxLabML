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

/**
 * Starts the hero's replay worker and loads both scenes into it: the
 * trained car first, then the Hide and Seek champions, whose physics
 * engine is the heaviest thing the page loads. Either half may fail on
 * its own (an old file, a blocked fetch), and the hero then shows what
 * did load, or keeps its poster. The worker goes when the hero unmounts.
 */
export function useShowcase(): Showcase {
  const [state, setState] = useState<Showcase>({ pool: null, car: null, arena: null });

  useEffect(() => {
    let gone = false;
    let pool: ShowcasePool | null = null;
    void (async () => {
      const [made, racerData] = await Promise.all([createShowcasePool(), fetchJson(HERO_RACER_PATH).catch(() => null)]);
      if (gone) return made.terminate();
      pool = made;
      setState((s) => ({ ...s, pool: made }));
      const racer = parseHeroRacer(racerData);
      if (racer) {
        const ghost = { generation: racer.file.generation, genome: racer.genome, seed: racer.file.replaySeed, scriptSource: null, slot: 0 };
        await made.replay.setGhostScene(racer.setup, [ghost]);
        made.car.subscribe(0, false);
        await made.replay.playGhosts(1, true, WARMUP_TICKS);
        if (gone) return;
        const car = { racer, track: buildTrack(racer.setup.track), schema: racingInputSchema(racer.setup.inputs, racer.setup.car) };
        setState((s) => ({ ...s, car }));
      }
      const refs = await loadReferences('hideseek');
      const pair = refs?.champions ? pickShowcasePair(refs.champions) : null;
      if (!pair || gone) return;
      const arena = { pair, hider: decodeGenome(base64ToBytes(pair.hider.genome)), seeker: decodeGenome(base64ToBytes(pair.seeker.genome)) };
      setState((s) => ({ ...s, arena }));
    })().catch(() => {
      // A hero that cannot load keeps its poster. Nothing else on the page depends on it.
    });
    return () => {
      gone = true;
      pool?.terminate();
    };
  }, []);

  return state;
}
