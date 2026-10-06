import { describe, expect, it } from 'vitest';
import { fromBlocks, toBlocks } from '../blocks';
import { compileScript } from '../compiler';
import { parse } from '../parser';
import { RACING_PRESETS, SCRIPT_PRESETS } from '../presets/racing';
import { print } from '../printer';
import { randomProgram } from './gen/program';
import { errors, shape } from './helpers';

const RANDOM_COUNT = 200;
const sources = [
  ...SCRIPT_PRESETS.map((p) => ({ name: p.id, source: p.source })),
  ...Array.from({ length: RANDOM_COUNT }, (_, i) => ({ name: `random ${i}`, source: randomProgram(1000 + i) })),
];

describe('generated programs', () => {
  it('are valid scripts', () => {
    for (const { name, source } of sources) {
      const found = errors(source);
      if (found.length > 0) throw new Error(`${name}: ${found[0].message}\n${source}`);
    }
  });
});

describe('printer round trip', () => {
  it('print is stable and reparsing gives the same tree', () => {
    for (const { name, source } of sources) {
      const first = parse(source).program;
      const printed = print(first);
      const again = parse(printed);
      expect(again.diagnostics, name).toEqual([]);
      expect(print(again.program), name).toBe(printed);
      expect(shape(again.program), name).toEqual(shape(first));
    }
  });

  it('keeps every comment', () => {
    for (const { name, source } of sources) {
      const count = (text: string) => text.split('\n').filter((l) => l.includes('//')).length;
      expect(count(print(parse(source).program)), name).toBe(count(source));
    }
  });

  it('presets are already in canonical form', () => {
    for (const p of SCRIPT_PRESETS) expect(print(parse(p.source).program), p.id).toBe(p.source);
  });
});

describe('block round trip', () => {
  it('program to blocks to program is lossless', () => {
    for (const { name, source } of sources) {
      const program = parse(source).program;
      const back = fromBlocks(toBlocks(program));
      expect(shape(back), name).toEqual(shape(program));
      expect(print(back), name).toBe(print(program));
    }
  });

  it('blocks to program to blocks gives the same workspace', () => {
    for (const { name, source } of sources) {
      const ws = toBlocks(parse(source).program);
      const json = JSON.parse(JSON.stringify(ws));
      expect(toBlocks(fromBlocks(json)), name).toEqual(ws);
    }
  });

  it('keeps block ids of unchanged statements when another statement changes', () => {
    const preset = RACING_PRESETS[1].source;
    const edited = preset.replace('reward +10 when lap.completed', 'reward +20 when lap.completed');
    const ids = (src: string) => toBlocks(parse(src).program).items.flatMap((i) => (i.children.body ?? []).map((b) => b.id));
    const before = ids(preset);
    const after = ids(edited);
    expect(after.filter((id) => !before.includes(id))).toHaveLength(1);
  });
});

describe('comments never change behavior', () => {
  it('editing a comment keeps the source hash and the fork hash', () => {
    for (const p of SCRIPT_PRESETS) {
      const a = compileScript(p.source).script;
      const b = compileScript(p.source.replace(/\/\/ .*/g, '// changed').replace('each tick {', 'each tick { // new note')).script;
      expect(a?.sourceHash).toBe(b?.sourceHash);
      expect(a?.forkHash).toBe(b?.forkHash);
    }
  });

  it('random programs compile', () => {
    for (const { name, source } of sources.slice(0, 60)) {
      const r = compileScript(source);
      expect(r.script, `${name}: ${r.diagnostics.find((d) => d.severity === 'error')?.message}`).not.toBeNull();
    }
  });
});
