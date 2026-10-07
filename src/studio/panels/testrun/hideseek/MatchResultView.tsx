'use client';

import { useMemo } from 'react';
import { HIDESEEK_LAYOUTS } from '@/engine/hideseek/layouts/presets';
import { Stat } from '@/ui/primitives/Panel';
import { ResultSection as Section } from '../ResultSection';
import { TickTable, type TickColumn } from '../TickTable';
import { TeamRewardChart } from './TeamRewardChart';
import type { MatchLog, MatchTestOk } from './types';

const TICK_SECONDS = 1 / 30;
const points = (v: number) => v.toFixed(2);
const share = (v: number) => `${Math.round(v * 100)}%`;

/** Both teams per tick: the points the tick gave and the running total. The narrowed view keeps ticks with events. */
function MatchTicks({ log }: { log: MatchLog }) {
  const columns = useMemo<TickColumn[]>(
    () => [
      { label: 'Hider', values: log.hiderReward, digits: 3, tone: 'signed', width: 60 },
      { label: 'Total', values: log.hiderTotal, digits: 2, width: 52 },
      { label: 'Seeker', values: log.seekerReward, digits: 3, tone: 'signed', width: 60 },
      { label: 'Total', values: log.seekerTotal, digits: 2, width: 52 },
    ],
    [log],
  );
  return <TickTable time={log.time} columns={columns} events={log.events} filterLabel="Only ticks with events" minWidth={470} />;
}

/** What one test match did: both teams' scores, how well the hider hid, the reward curves, the cost and every tick. */
export function MatchResultView({ result, estimate }: { result: MatchTestOk; estimate: number | null }) {
  const players = result.brains === 'test' ? 'the test players' : `random ${result.blueprint} brains`;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Hider total" value={<span className="text-hider">{points(result.hiderTotal)}</span>} />
        <Stat label="Seeker total" value={<span className="text-seeker">{points(result.seekerTotal)}</span>} />
        <Stat label="Grabs" value={result.grabs} hint="Boxes picked up, by both players together" />
        <Stat label="Hidden" value={share(result.hiddenShare)} hint="Share of the seek phase the hider spent out of the seeker's sight" />
        <Stat label="Seen" value={share(result.seenShare)} hint="Share of the seek phase the seeker had the hider in sight" />
        <Stat label="Locks" value={result.locks} hint="Boxes locked, by both players together" />
      </div>
      <Section title="Reward" hint={`${(result.ticks * TICK_SECONDS).toFixed(1)} s in the ${HIDESEEK_LAYOUTS[result.layout].name.toLowerCase()} with ${players}`}>
        <TeamRewardChart log={result.log} prepSeconds={result.prepTicks * TICK_SECONDS} />
      </Section>
      <Section title="Cost" hint="per tick">
        <div className="grid grid-cols-2 gap-3 rounded-md border border-border bg-surface-2 p-3">
          <Stat label="Script, measured" value={`${result.scriptMicros.toFixed(3)} µs`} hint="The script alone for one player, timed in a tight loop over player states from this match" />
          <Stat label="Whole tick" value={`${result.tickMicros.toFixed(1)} µs`} hint="Physics, sight, rays, both brains and the script for both players" />
        </div>
        {estimate !== null && <p className="text-[11px] text-subtle">The editor estimated {estimate.toFixed(3)} µs for the script. Measurements vary with the machine and what else is running.</p>}
      </Section>
      <Section title="Ticks">
        <MatchTicks log={result.log} />
      </Section>
    </div>
  );
}
