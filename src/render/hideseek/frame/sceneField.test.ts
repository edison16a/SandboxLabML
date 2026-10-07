import { describe, expect, it } from 'vitest';
import { SceneField } from './sceneField';

describe('SceneField', () => {
  it('finds the nearest awake agent of a team and passes over a nearer sleeper', () => {
    const field = new SceneField();
    field.agentCount = 3;
    Object.assign(field.agents[0], { x: 0, z: 0, team: 0, frozen: false });
    // A seeker asleep right next to the hider, and an awake one further off.
    Object.assign(field.agents[1], { x: 1, z: 0, team: 1, frozen: true });
    Object.assign(field.agents[2], { x: 6, z: 0, team: 1, frozen: false });
    expect(field.nearest(1, 0, 0)).toBe(2);
    field.agents[2].frozen = true;
    expect(field.nearest(1, 0, 0)).toBe(-1);
    expect(field.nearest(0, 5, 0)).toBe(0);
  });
});
