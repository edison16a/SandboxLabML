'use client';

import { HIDESEEK_OUTPUTS } from '@/engine/hideseek/sensing/inputSchema';
import { RACING_OUTPUTS } from '@/engine/racing/sensors/inputSchema';
import { cn } from '@/ui/cn';
import type { ShowcasePool } from '@/workers/client/showcasePool';
import type { SceneReady } from '../scenes';
import { BrainPanel } from './BrainPanel';
import type { ArenaMatchState } from './useArenaMatch';
import type { ArenaShowcase, CarShowcase } from './useShowcase';

const CAR_OUTPUTS = RACING_OUTPUTS.map((o) => o.label);
const ARENA_OUTPUTS = HIDESEEK_OUTPUTS.map((o) => o.label);

interface Props {
  stacked: boolean;
  pool: ShowcasePool;
  car: CarShowcase | null;
  arena: ArenaShowcase | null;
  match: ArenaMatchState;
  shown: SceneReady;
}

/**
 * One brain card per scene, each in its own scene's outer corner: the
 * racing card bottom left, the arena card bottom right. Stacked, the
 * racing card moves to the top left so it stays in its own scene. Each
 * card shows the brain in charge lighting up live, with a line of real
 * numbers under it. In the arena the hider's brain shows while hiders
 * hide and the seeker's once seekers wake.
 */
export function HeroPanels({ stacked, pool, car, arena, match, shown }: Props) {
  const team = match.prep ? 0 : 1;
  return (
    <>
      {car && shown.car && (
        <div data-hero-card="car" className={cn('absolute left-6', stacked ? 'top-6' : 'bottom-6')}>
          <BrainPanel
            title="Car brain"
            dot="bg-accent"
            genome={car.racer.genome}
            outputLabels={CAR_OUTPUTS}
            stream={pool.car}
            inspect={0}
            status="Grand Prix"
            detail={`Gen ${car.racer.file.generation + 1}, lap ${car.racer.file.lapTime.toFixed(1)} s`}
          />
        </div>
      )}
      {arena && shown.arena && (
        <div data-hero-card="arena" className="absolute right-6 bottom-6">
          <BrainPanel
            key={team}
            className="animate-fade-in"
            title={team === 0 ? 'Hider brain' : 'Seeker brain'}
            dot={team === 0 ? 'bg-hider' : 'bg-seeker'}
            genome={team === 0 ? arena.hider : arena.seeker}
            outputLabels={ARENA_OUTPUTS}
            stream={pool.arena}
            inspect={team}
            status={match.prep ? 'Hiders hide' : 'Seekers seek'}
            detail={`${match.left} s left`}
          />
        </div>
      )}
    </>
  );
}
