import { describe, expect, it } from 'vitest';
import type { RunConfig } from '@/engine/training/runConfig';
import { runScriptInfo, scriptName } from './runScript';

const source = (name: string) => `// A comment first\nscript "${name}" for racing v1\nbrain racing-starter\n`;

function run(scripts: RunConfig['scripts']): RunConfig {
  return { scripts } as RunConfig;
}

describe('naming the script a run trains with', () => {
  it('reads the name from the header line', () => {
    expect(scriptName(source('Beginner: first laps'))).toBe('Beginner: first laps');
    expect(scriptName('each tick {}')).toBe('Untitled script');
  });

  it('says built-in rewards when the run has no script', () => {
    expect(runScriptInfo(run([]), 4)).toEqual({ name: 'Built-in rewards', builtin: true, editedAt: null });
  });

  it('names the version in force at the generation and when it was edited in', () => {
    const r = run([
      { fromGeneration: 0, source: source('First'), hash: 'a' },
      { fromGeneration: 12, source: source('Second'), hash: 'b' },
    ]);
    expect(runScriptInfo(r, 5)).toEqual({ name: 'First', builtin: false, editedAt: null });
    expect(runScriptInfo(r, 20)).toEqual({ name: 'Second', builtin: false, editedAt: 12 });
  });
});
