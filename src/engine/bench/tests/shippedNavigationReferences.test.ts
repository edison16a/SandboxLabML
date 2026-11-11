import { describe, expect, it } from 'vitest';
import { findPresetBlueprint } from '../../blueprints/presets';
import { NAVIGATION_ENGINE_VERSION } from '../../navigation/params';
import { navigationInputCount, type NavigationInputConfig } from '../../navigation/sensors/inputConfig';
import { base64ToBytes, decodeGenome } from '../../neat/serialize';
import { compileScript } from '../../script/compiler';
import { findScriptPreset } from '../../script/presets';
import { NAVIGATION_BENCHMARK_VERSION } from '../navigation/axes';
import { readReferences } from '../nodeReferences';

/**
 * The shipped Navigation reference file must come from the current engine
 * and benchmark. Bumping either version fails this test until the file is
 * regenerated with npm run refs -- --env navigation. Tier order is not
 * checked: the shipped file may be a small smoke run.
 */
describe('public/references/navigation.json', () => {
  it('matches the current engine and benchmark versions', async () => {
    const refs = await readReferences('navigation');
    expect(refs, 'Run npm run refs -- --env navigation to generate the file.').not.toBeNull();
    expect(refs?.env).toBe('navigation');
    expect(refs?.engineVersion).toBe(NAVIGATION_ENGINE_VERSION);
    expect(refs?.benchmarkVersion).toBe(NAVIGATION_BENCHMARK_VERSION);
    expect(refs?.references.map((r) => r.tier)).toEqual(['beginner', 'intermediate', 'advanced']);
  });

  it('ships one playable model per preset, whose brain fits its blueprint and script', async () => {
    const refs = await readReferences('navigation');
    expect(refs?.models?.map((m) => m.tier)).toEqual(['beginner', 'intermediate', 'advanced']);
    for (const m of refs?.models ?? []) {
      const blueprint = findPresetBlueprint(m.blueprint);
      const preset = findScriptPreset(m.preset);
      expect(blueprint?.env).toBe('navigation');
      expect(preset?.tier).toBe(m.tier);
      const sensors = compileScript(preset!.source).script!.sensors.length;
      const genome = decodeGenome(base64ToBytes(m.genome));
      expect(genome.inputs.length).toBe(navigationInputCount(blueprint!.inputs as NavigationInputConfig) + sensors);
      expect(m.score).toBeGreaterThan(30);
    }
  });
});
