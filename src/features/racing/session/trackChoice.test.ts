import { describe, expect, it } from 'vitest';
import { buildTrack } from '@/engine/racing/track/buildTrack';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';
import { checkTrack } from '@/engine/racing/track/validate';
import { blankLoop, forTraining, nextTrackName, sameRoad } from './trackChoice';

const oval = BUILT_IN_TRACKS[0];

describe('track choice', () => {
  it('compares roads by shape and width only', () => {
    expect(sameRoad(oval, { ...oval, id: 'x', name: 'Renamed' })).toBe(true);
    expect(sameRoad(oval, { ...oval, width: oval.width + 1 })).toBe(false);
    expect(sameRoad(oval, { ...oval, points: oval.points.slice(1) })).toBe(false);
  });

  it('starts drawing from a loop the car can drive', () => {
    const problems = checkTrack(buildTrack(blankLoop(9)));
    expect(problems.tooTight).toBe(false);
    expect(problems.selfIntersects).toBe(false);
  });

  it('gives an edited preset its own id before training on it', () => {
    expect(forTraining(oval, oval)).toBe(oval);
    const edited = forTraining({ ...oval, width: 12 }, oval);
    expect(edited.id).not.toBe(oval.id);
    expect(edited.name).toBe('Custom track');
  });

  it('numbers quick saves past the names already taken', () => {
    expect(nextTrackName([])).toBe('My track 1');
    expect(nextTrackName(['My track 1', 'my track 2', 'Kidney'])).toBe('My track 3');
  });
});
