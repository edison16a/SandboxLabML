import { describe, expect, it } from 'vitest';
import { racingModule } from '../../racing/module';
import type { GenerationRecord } from '../../training/records';
import { bestMetric, metricValue, type MetricSpec } from '../metrics';

const record = (champion: Record<string, unknown>, metrics?: Record<string, number>) => ({ champion: { genomeId: 1, fitness: 2, stopReason: null, ...champion }, metrics }) as unknown as GenerationRecord;

const share: MetricSpec = { key: 'arrived', label: 'Arrived', unit: '%', source: 'generation', better: 'higher', format: String };
const time: MetricSpec = { key: 'time', label: 'Time', unit: 's', source: 'champion', better: 'lower', missing: 0, format: String };

describe('env metrics', () => {
  it('reads Racing fields off the champion and treats a lap time of 0 as none', () => {
    const [distance, lap] = racingModule.metrics;
    const r = record({ distance: 412.4, bestLapTime: 0 });
    expect(metricValue(r, distance)).toBe(412.4);
    expect(metricValue(r, lap)).toBeNaN();
    expect(lap.format(metricValue(r, lap))).toBe('-');
    expect(distance.format(412.4)).toBe('412 m');
    expect(lap.format(31.256)).toBe('31.26 s');
  });

  it('reads newer envs from the metrics maps and leaves a gap when one is missing', () => {
    expect(metricValue(record({ metrics: { time: 12 } }), time)).toBe(12);
    expect(metricValue(record({}, { arrived: 0.5 }), share)).toBe(0.5);
    expect(metricValue(record({}), share)).toBeNaN();
  });

  it('keeps the best value in the direction the metric prefers', () => {
    const history = [record({ metrics: { time: 0 } }, { arrived: 0.2 }), record({ metrics: { time: 14 } }, { arrived: 0.7 }), record({ metrics: { time: 11 } })];
    expect(bestMetric(history, time)).toBe(11);
    expect(bestMetric(history, share)).toBe(0.7);
    expect(bestMetric([], share)).toBeNaN();
  });
});
