import { describe, expect, it } from 'vitest';
import { compileScript } from '../../script/compiler';
import { LESSON_SETTINGS, lessonSettings } from './lessons';

const script = (generation: string) =>
  compileScript(`script "t" for driving v1
brain driving-standard
each tick {
  drive(steer: brain.steer, pedal: brain.pedal)
  reward +0.02 * route.gain
}
each generation {
${generation}
}
`).script!;

describe('lessonSettings', () => {
  it('stays on empty streets in Midtown without a script or a level request', () => {
    expect(lessonSettings()).toEqual(LESSON_SETTINGS);
    expect(lessonSettings(script('  autoLevel(share: 20%)'))).toEqual(LESSON_SETTINGS);
  });

  it('drives the level and city a generation block asks for, still one trip', () => {
    const s = lessonSettings(script('  useLevel(level: 2)\n  useCity(id: "harbor")\n  routesPerGeneration(count: 3)'));
    expect(s).toEqual({ ...LESSON_SETTINGS, level: 2, city: 'harbor' });
  });

  it('keeps the level in range', () => {
    expect(lessonSettings(script('  useLevel(level: 9)')).level).toBe(5);
  });
});
