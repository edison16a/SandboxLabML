import { describe, expect, it } from 'vitest';
import { blockPalette, fromBlocks, toBlocks, type ScriptBlock } from '../blocks';
import { parse } from '../parser';
import { findScriptPreset } from '../presets/racing';
import { print } from '../printer';
import { errors } from './helpers';

const VALUE_TYPES = new Set(['number', 'text', 'boolean', 'name', 'unary', 'binary', 'callValue', 'settings']);

/** Puts one palette template into a script, inside a reward when it is a value, and prints it. */
function placed(template: ScriptBlock, scope: 'tick' | 'generation'): string {
  const ws = toBlocks(parse(`script "p" for racing v1\neach ${scope} {\n  reward 1\n}\n`).program);
  const host = ws.items[0].children.body[0];
  const block = VALUE_TYPES.has(template.type) ? { ...host, inputs: [{ name: 'value', block: template }, { name: 'when', block: null }] } : template;
  return print(fromBlocks({ ...ws, items: [{ ...ws.items[0], children: { body: [block] } }] }));
}

describe('block palette', () => {
  it('groups tick blocks by category from the registry', () => {
    const palette = blockPalette('racing', 'tick');
    const keys = new Map(palette.map((c) => [c.id, c.items.map((i) => i.key)]));
    expect([...keys.keys()]).toEqual(['sensors', 'actions', 'rewards', 'logic', 'math']);
    expect(keys.get('sensors')).toContain('car.speed');
    expect(keys.get('sensors')).toContain('rays');
    expect(keys.get('actions')).toEqual(expect.arrayContaining(['drive', 'brain.steer']));
    expect(keys.get('rewards')).toEqual(['reward', 'stop']);
    expect(keys.get('math')).toEqual(expect.arrayContaining(['abs', 'rand', 'pi', 'dt']));
  });

  it('shows evolution and environment blocks only in each generation', () => {
    const keys = blockPalette('racing', 'generation').flatMap((c) => c.items.map((i) => i.key));
    expect(keys).toEqual(expect.arrayContaining(['speciate', 'select', 'breed', 'keepChampions', 'generation', 'useTrack', 'randomTrack']));
    expect(keys).not.toContain('drive');
    expect(keys).not.toContain('reward');
  });

  it('every template turns into a line of SBL that parses', () => {
    for (const scope of ['tick', 'generation'] as const) {
      for (const item of blockPalette('racing', scope).flatMap((c) => c.items)) {
        const text = placed(item.template, scope);
        expect(parse(text).diagnostics, `${item.key}\n${text}`).toEqual([]);
      }
    }
  });

  it('templates with nothing to fill in are valid as they are', () => {
    const drive = blockPalette('racing', 'tick').flatMap((c) => c.items).find((i) => i.key === 'drive')!;
    expect(errors(placed(drive.template, 'tick'))).toEqual([]);
    const speed = blockPalette('racing', 'tick').flatMap((c) => c.items).find((i) => i.key === 'car.speed')!;
    expect(placed(speed.template, 'tick')).toContain('reward car.speed');
  });
});

describe('block editing', () => {
  it('a field edited in the block view shows up in the text', () => {
    const ws = toBlocks(parse(findScriptPreset('racing-intermediate')!.source).program);
    const tick = ws.items.find((b) => b.type === 'each' && b.fields.event === 'tick')!;
    const lap = tick.children.body.find((b) => b.type === 'reward' && JSON.stringify(b.inputs).includes('lap.completed'))!;
    const value = lap.inputs[0].block!;
    expect(value.type).toBe('unary');
    value.inputs[0].block!.fields.value = 25;
    expect(print(fromBlocks(ws))).toContain('reward +25 when lap.completed');
  });

  it('an empty slot prints as a hole the checker reports', () => {
    const ws = toBlocks(parse('script "t" for racing v1\neach tick {\n  stop "x" when car.offTrack\n}\n').program);
    ws.items[0].children.body[0].inputs[0].block = null;
    const text = print(fromBlocks(ws));
    expect(text).toContain('stop "x" when _');
    expect(errors(text).map((d) => d.code)).toEqual(['unknown-name']);
  });
});
