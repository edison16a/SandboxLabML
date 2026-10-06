'use client';

import { useMemo } from 'react';
import { Stat } from '@/ui/primitives/Panel';
import { ResultSection as Section } from './ResultSection';
import { RewardChart } from './RewardChart';
import { TickTable, type TickColumn } from './TickTable';
import type { TestRunOk, TickLog } from './types';

/** Racing ticks: the points each tick gave, the running total and the speed. Ticks with points count as notable. */
function RacingTicks({ log }: { log: TickLog }) {
  const columns = useMemo<TickColumn[]>(
    () => [
      { label: 'Reward', values: log.reward, digits: 3, tone: 'signed' },
      { label: 'Total', values: log.total, digits: 2 },
      { label: 'Speed', values: log.speed, digits: 1, tone: 'muted', width: 60 },
    ],
    [log],
  );
  const notable = useMemo(() => (t: number) => Math.abs(log.reward[t]) >= 1e-9, [log]);
  return <TickTable time={log.time} columns={columns} events={log.events} notable={notable} filterLabel="Only ticks with points or events" />;
}

/** What one test episode did: how it ended, the reward curve, the cost and every tick. */
export function TestRunResultView({ result, estimate }: { result: TestRunOk; estimate: number | null }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Stopped by" value={<span className="font-sans">{result.stopReason}</span>} />
        <Stat label="Total reward" value={result.totalReward.toFixed(2)} />
        <Stat label="Distance" value={`${Math.round(result.distance)} m`} />
        <Stat label="Laps" value={result.laps} />
      </div>
      <Section title="Reward" hint={`${(result.ticks / 30).toFixed(1)} s with ${result.blueprint}`}>
        <RewardChart log={result.log} />
      </Section>
      <Section title="Cost" hint="per car per tick">
        <div className="grid grid-cols-3 gap-3 rounded-md border border-border bg-surface-2 p-3">
          <Stat label="Script, measured" value={`${result.scriptMicros.toFixed(3)} µs`} hint="The script alone, timed in a tight loop over car states from this run" />
          <Stat label="Whole tick" value={`${result.tickMicros.toFixed(2)} µs`} hint="Physics, rays, brain and script for one car" />
          <Stat label="Turbo" value={`${Math.round(result.turboShare * 100)}%`} hint="Share of built-in Turbo speed this script keeps" />
        </div>
        {estimate !== null && <p className="text-[11px] text-subtle">The editor estimated {estimate.toFixed(3)} µs for the script. Measurements vary with the machine and what else is running.</p>}
      </Section>
      <Section title="Ticks">
        <RacingTicks log={result.log} />
      </Section>
    </div>
  );
}
