import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { DrivingReferenceModel } from '../../../src/engine/bench/driving/models';
import { DRIVING_BENCHMARK_VERSION, DRIVING_ENGINE_VERSION } from '../../../src/engine/driving/version';
import { keepBetterModels, shippedModels } from './keep';
import type { PickedDrivingModel } from './pick';

const inputs = { lidar: { count: 5, fov: 2, range: 40 }, noise: 0 } as unknown as DrivingReferenceModel['inputs'];
const model = (tier: DrivingReferenceModel['tier'], seed: number): DrivingReferenceModel => ({ tier, seed, generation: 100, score: 50, blueprint: 'driving-standard', inputs, genome: `g${seed}` });
const picked = (tier: DrivingReferenceModel['tier'], seed: number, checkShares: number[]): PickedDrivingModel => ({ ...model(tier, seed), pickShare: 0.5, checkShares });

describe('keeping the better Driving model', () => {
  vi.spyOn(console, 'log').mockImplementation(() => {});

  it('keeps the shipped model, unchanged, only where it drives the check trips better', () => {
    const old = [model('beginner', 1), model('advanced', 2)];
    const drive = (m: DrivingReferenceModel) => (m.seed === 1 ? [0.9, 0.9, 0.9, 0.9] : [0.2, 0.2, 0.2, 0.2]);
    const out = keepBetterModels([picked('beginner', 7, [0.5, 0.5, 0.5, 0.5]), picked('intermediate', 8, [0.1, 0, 0, 0]), picked('advanced', 9, [0.6, 0.6, 0.6, 0.6])], old, drive);
    expect(out[0]).toBe(old[0]);
    // No shipped model of a tier means the pick ships, and the pick's own numbers stay out of the file.
    expect(out[1]).toEqual(model('intermediate', 8));
    expect(out[2]).toEqual(model('advanced', 9));
  });

  it('gives a tie to the new pick', () => {
    const out = keepBetterModels([picked('beginner', 7, [0.5, 0.5, 0.5, 0.5])], [model('beginner', 1)], () => [0.5, 0.5, 0.5, 0.5]);
    expect(out[0].seed).toBe(7);
  });

  it('reads no models to beat from a file of another engine or benchmark', () => {
    const dir = mkdtempSync(join(tmpdir(), 'refs-'));
    const file = (engineVersion: number) => {
      const path = join(dir, `${engineVersion}.json`);
      writeFileSync(path, JSON.stringify({ env: 'driving', benchmarkVersion: DRIVING_BENCHMARK_VERSION, engineVersion, models: [model('beginner', 1)] }));
      return path;
    };
    expect(shippedModels(file(DRIVING_ENGINE_VERSION))).toHaveLength(1);
    expect(shippedModels(file(DRIVING_ENGINE_VERSION + 1))).toEqual([]);
    expect(shippedModels(join(dir, 'missing.json'))).toEqual([]);
  });
});
