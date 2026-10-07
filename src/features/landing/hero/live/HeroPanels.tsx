'use client';

import { HIDESEEK_OUTPUTS } from '@/engine/hideseek/sensing/inputSchema';
import { RACING_OUTPUTS } from '@/engine/racing/sensors/inputSchema';
import type { ShowcasePool } from '@/workers/client/showcasePool';
import type { HeroScene } from '../sceneCycle';
import { BrainPanel } from './BrainPanel';
import { CARD } from './card';
import type { ArenaMatchState } from './useArenaMatch';
import type { ArenaShowcase, CarShowcase } from './useShowcase';

const CAR_OUTPUTS = RACING_OUTPUTS.map((o) => o.label);
const ARENA_OUTPUTS = HIDESEEK_OUTPUTS.map((o) => o.label);

interface Props {
  scene: HeroScene;
  pool: ShowcasePool;
  car: CarShowcase | null;
  arena: ArenaShowcase | null;
  match: ArenaMatchState;
}


/**
 * The two corner cards over the live scene: on the left what is playing,
 * with real numbers from the run or the match clock, and on the right the
 * brain in charge, lighting up live. During Hide and Seek the hider's
 * brain shows while hiders hide and the seeker's once seekers wake. Below
 * 1280 px the cards are narrower, so they stay clear of the centered text.
 */
export function HeroPanels({ scene, pool, car, arena, match }: Props) {
  const showArena = scene === 'arena' && arena;
  const team = match.prep ? 0 : 1;
  return (
    <div className="absolute inset-x-6 bottom-6 flex items-end justify-between gap-6">
      <div key={`caption-${scene}`} className={`${CARD} max-w-[240px] animate-fade-in px-4 py-3 xl:max-w-[280px] 2xl:max-w-[300px]`}>
        <div className="flex items-center gap-2 text-[12px] font-medium">
          <span className="size-1.5 rounded-full bg-success" />
          <span className="text-fg">Live</span>
          <span className="text-muted">{showArena ? 'Hide and Seek' : 'Racing'}</span>
        </div>
        {showArena ? (
          <>
            <p className="mt-1.5 text-[13px] leading-snug text-fg/90">2 hiders vs 2 seekers</p>
            <p className="mt-1 font-mono text-[11px] text-muted tabular">
              {match.prep ? 'Hiders hide' : 'Seekers seek'}, {match.left} s left
            </p>
          </>
        ) : (
          car && (
            <>
              <p className="mt-1.5 text-[13px] leading-snug text-fg/90">Grand Prix</p>
              <p className="mt-1 font-mono text-[11px] text-muted tabular">
                Generation {car.racer.file.generation + 1}, best lap {car.racer.file.lapTime.toFixed(1)} s
              </p>
            </>
          )
        )}
      </div>
      {showArena ? (
        <BrainPanel
          key={`brain-arena-${team}`}
          className="animate-fade-in"
          title={team === 0 ? 'Hider brain' : 'Seeker brain'}
          dot={team === 0 ? 'bg-hider' : 'bg-seeker'}
          genome={team === 0 ? arena.hider : arena.seeker}
          outputLabels={ARENA_OUTPUTS}
          stream={pool.arena}
          inspect={team}
        />
      ) : (
        car && (
          <BrainPanel key="brain-car" className="animate-fade-in" title="Car brain" dot="bg-accent" genome={car.racer.genome} outputLabels={CAR_OUTPUTS} stream={pool.car} inspect={0} />
        )
      )}
    </div>
  );
}
