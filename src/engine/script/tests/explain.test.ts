import { describe, expect, it } from 'vitest';
import type { EachItem } from '../ast';
import { explainStmt } from '../explain';
import { parse } from '../parser';
import { findScriptPreset } from '../presets/racing';

function explainBlock(source: string, event: 'tick' | 'generation'): string[] {
  const each = parse(source).program.items.find((i) => i.kind === 'each' && i.event === event) as EachItem;
  return each.body.stmts.map((s) => explainStmt(s, 'racing'));
}

describe('explain', () => {
  it('reads the Intermediate tick block as plain sentences', () => {
    expect(explainBlock(findScriptPreset('racing-intermediate')!.source, 'tick')).toEqual([
      "Steer by the brain's steering and press the pedal by the brain's pedal",
      "Give +0.002 times the car's speed every tick",
      'Give +1 when the car passes a checkpoint',
      'Give +10 when the car finishes a lap',
      'End the run as "crash" when the car leaves the road',
      'End the run as "stalled" when the time without progress is above 3 s',
    ]);
  });

  it('reads the Advanced generation block', () => {
    const lines = explainBlock(findScriptPreset('racing-advanced')!.source, 'generation');
    expect(lines[0]).toBe('Aim for 10 species');
    expect(lines[1]).toBe('Let the top 20% of each species breed');
    expect(lines.at(-1)).toBe('If the generation number modulo 10 equals 0 and the generation number is above 0');
  });
});
