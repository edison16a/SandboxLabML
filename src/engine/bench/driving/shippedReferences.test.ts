import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findPresetBlueprint } from '../../blueprints/presets';
import { builtInInputCount } from '../../driving/sensors/inputSchema';
import { DRIVING_BENCHMARK_VERSION, DRIVING_ENGINE_VERSION } from '../../driving/version';
import { base64ToBytes, decodeGenome } from '../../neat/serialize';
import { readReferences } from '../nodeReferences';
import { parseDrivingModels } from './models';

/**
 * The shipped Driving reference file. A version bump makes this fail, which
 * is the reminder to regenerate it (docs/benchmark.md says how).
 */
describe('public/references/driving.json', () => {
  it('matches the current engine and benchmark', async () => {
    const refs = await readReferences('driving');
    expect(refs?.env).toBe('driving');
    expect(refs?.benchmarkVersion).toBe(DRIVING_BENCHMARK_VERSION);
    expect(refs?.engineVersion).toBe(DRIVING_ENGINE_VERSION);
    expect(refs?.references.map((r) => r.tier)).toEqual(['beginner', 'intermediate', 'advanced']);
  });

  it('ships a model per tier that fits its own inputs', () => {
    const models = parseDrivingModels(JSON.parse(readFileSync('public/references/driving.json', 'utf8')));
    expect(models.map((m) => m.tier).sort()).toEqual(['advanced', 'beginner', 'intermediate']);
    for (const m of models) {
      const genome = decodeGenome(base64ToBytes(m.genome));
      expect(genome.inputs.length, m.tier).toBe(builtInInputCount(m.inputs));
      expect(genome.outputs).toHaveLength(2);
      expect(findPresetBlueprint(m.blueprint)?.env).toBe('driving');
    }
  });

  it('reads no models from a file of another lab or a broken one', () => {
    expect(parseDrivingModels({ env: 'navigation', models: [] })).toEqual([]);
    expect(parseDrivingModels({ env: 'driving', models: [{ tier: 'beginner' }] })).toEqual([]);
    expect(parseDrivingModels(null)).toEqual([]);
  });
});
