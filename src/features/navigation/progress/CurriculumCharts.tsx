'use client';

import { NAV_LEVELS } from '@/engine/navigation/course/levels';
import { NAV_METRIC } from '@/engine/navigation/pipeline/metricSpecs';
import { Section } from '@/features/lab/components/Section';
import { useNavigationLab } from '../state/labStore';
import { FINISH_SERIES, FinishChart } from './FinishChart';
import { LevelChart } from './LevelChart';

/** A small key under a chart: a short line in each series' color and its name. */
function Legend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
      {[...FINISH_SERIES].reverse().map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}

const pct = (v: number | undefined) => (v === undefined ? '-' : `${Math.round(v * 100)}%`);

/**
 * Navigation's own charts in the Progress tab: the level timeline, then
 * the share of runs that finished (the best fifth and everyone) and died.
 */
export function CurriculumCharts() {
  const records = useNavigationLab((s) => s.records);
  const last = records[records.length - 1];
  const level = last?.metrics?.[NAV_METRIC.level] ?? 0;
  return (
    <>
      <Section title="Curriculum" hint={`now level ${level}, ${NAV_LEVELS[level]?.name ?? ''}`} tour="curriculum">
        <LevelChart records={records} />
      </Section>
      <Section title="Finishing" hint={`best fifth ${pct(last?.metrics?.[NAV_METRIC.eliteShare])}, everyone ${pct(last?.metrics?.[NAV_METRIC.finishShare])}`}>
        <FinishChart records={records} />
        <Legend />
      </Section>
    </>
  );
}
