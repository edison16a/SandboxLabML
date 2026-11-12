import { describe, expect, it } from 'vitest';
import { DRIVING_METRICS } from '../../driving/run/metrics';
import { NAV_METRIC, NAVIGATION_METRICS } from '../../navigation/pipeline/metricSpecs';
import type { GenerationRecord } from '../../training/records';
import { bestMetric, chartedMetrics, metricValue, summaryMetric, type MetricSpec } from '../metrics';

const record = (champion: Record<string, unknown>, metrics?: Record<string, number>) => ({ champion: { genomeId: 1, fitness: 2, stopReason: null, ...champion }, metrics }) as unknown as GenerationRecord;

const share: MetricSpec = { key: 'arrived', label: 'Arrived', unit: '%', source: 'generation', better: 'higher', format: String };
const time: MetricSpec = { key: 'time', label: 'Time', unit: 's', source: 'champion', better: 'lower', missing: 0, format: String };

describe('env metrics', () => {
  it("reads a champion's own numbers from its metrics and treats the missing value as none", () => {
    const finish = NAVIGATION_METRICS.find((m) => m.key === NAV_METRIC.finishTime)!;
    const progress = NAVIGATION_METRICS.find((m) => m.key === NAV_METRIC.progress)!;
    const r = record({ metrics: { progress: 0.42, finishTime: 0 } });
    expect(metricValue(r, progress)).toBe(0.42);
    expect(metricValue(r, finish)).toBeNaN();
    expect(finish.format(metricValue(r, finish))).toBe('-');
    expect(progress.format(0.42)).toBe('42%');
    expect(finish.format(12.26)).toBe('12.3 s');
  });

  it('reads generation metrics from the record and leaves a gap when one is missing', () => {
    expect(metricValue(record({ metrics: { time: 12 } }), time)).toBe(12);
    expect(metricValue(record({}, { arrived: 0.5 }), share)).toBe(0.5);
    expect(metricValue(record({}), share)).toBeNaN();
    // A champion's own numbers live only in its metrics map.
    expect(metricValue(record({ time: 12 }), time)).toBeNaN();
  });

  it('keeps the best value in the direction the metric prefers', () => {
    const history = [record({ metrics: { time: 0 } }, { arrived: 0.2 }), record({ metrics: { time: 14 } }, { arrived: 0.7 }), record({ metrics: { time: 11 } })];
    expect(bestMetric(history, time)).toBe(11);
    expect(bestMetric(history, share)).toBe(0.7);
    expect(bestMetric([], share)).toBeNaN();
  });

  it('charts every generation metric and the champion metrics that ask for it', () => {
    const speed: MetricSpec = { ...time, key: 'speed', chart: true };
    expect(chartedMetrics([share, time, speed]).map((m) => m.key)).toEqual(['arrived', 'speed']);
    // Driving draws its generation metrics in its own charts, so the shared Progress tab charts none of them.
    expect(chartedMetrics(DRIVING_METRICS)).toEqual([]);
  });

  it('shows the metric marked summary on a run card, else the first champion metric', () => {
    expect(summaryMetric(NAVIGATION_METRICS)?.key).toBe(NAV_METRIC.level);
    expect(summaryMetric([share, time])?.key).toBe('time');
  });
});
