import { describe, expect, it } from 'vitest';
import type { EachItem } from '../ast';
import type { EnvId } from '../../env/types';
import { explainStmt } from '../explain';
import { parse } from '../parser';
import { findScriptPreset } from '../presets';

function explainBlock(source: string, event: 'tick' | 'generation', env: EnvId = 'driving'): string[] {
  const each = parse(source).program.items.find((i) => i.kind === 'each' && i.event === event) as EachItem;
  return each.body.stmts.map((s) => explainStmt(s, env));
}

describe('explain', () => {
  it('reads the Driving Intermediate tick block as plain sentences', () => {
    const lines = explainBlock(findScriptPreset('driving-intermediate')!.source, 'tick');
    expect(lines.slice(0, 2)).toEqual(["Steer by the brain's steering and press the pedal by the brain's pedal", 'Give +0.02 times the new ground along the route every tick']);
    expect(lines).toContain('Give +10 when the SUV arrives');
    expect(lines).toContain('Give -4 when the SUV hits a person');
    expect(lines.slice(-2)).toEqual(['End the run as "redlight" when the SUV runs a red light', 'End the run as "stuck" when the time without progress is above 8 s']);
  });

  it('reads the Driving Advanced generation block', () => {
    const lines = explainBlock(findScriptPreset('driving-advanced')!.source, 'generation');
    expect(lines[0]).toBe('Aim for 5 species');
    expect(lines[1]).toBe('Let the top 20% of each species breed');
    expect(lines.at(-1)).toBe('If the current level is at least 3 and the generation number modulo 2 equals 0');
  });

  it("reads a Navigation block in that env's own words", () => {
    const lines = explainBlock(findScriptPreset('navigation-intermediate')!.source, 'tick', 'navigation');
    expect(lines[0]).toBe("Move by the brain's move and turn by the brain's turn");
    expect(lines).toContain('Give -3 when the runner dies');
  });
});
