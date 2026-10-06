import { describe, expect, it } from 'vitest';
import { drivenDistance, frontCopies } from './telemetry';

describe('sandbox telemetry', () => {
  it("measures distance from the car's own grid slot", () => {
    expect(drivenDistance({ distance: Float32Array.from([-30, -20, -10]) })).toBe(20);
    expect(drivenDistance({ distance: Float32Array.from([0.1, 50, 480]) })).toBeCloseTo(479.9, 4);
    expect(drivenDistance({ distance: new Float32Array(0) })).toBe(0);
  });

  it('lets the copy nearest the front speak for each champion', () => {
    const lines = [
      { generation: 2, slot: 4 },
      { generation: 9, slot: 2 },
      { generation: 9, slot: 0 },
      { generation: 9, slot: 1 },
    ];
    const front = frontCopies(lines);
    expect(front.get(9)?.slot).toBe(0);
    expect(front.get(2)?.slot).toBe(4);
    expect([...front.keys()]).toEqual([2, 9]);
  });
});
