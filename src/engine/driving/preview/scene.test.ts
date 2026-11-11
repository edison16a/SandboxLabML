import { describe, expect, it } from 'vitest';
import { recordPreview } from '../../lessons/preview/record';
import { DRIVING_INTERMEDIATE } from '../../script/presets/drivingIntermediate';
import { WORLD_SIZE } from '../snapshot';
import type { DrivingPreviewScene } from './scene';

describe('the Driving lesson preview', () => {
  it('records the test drive with its city, its world and its lidar', async () => {
    const result = await recordPreview(DRIVING_INTERMEDIATE);
    if (!result.ok || result.preview.kind !== 'episode') throw new Error(result.ok ? 'not an episode' : result.message);
    const p = result.preview;
    expect(p.env).toBe('driving');
    expect(p.stopReason).toBe('arrived');
    expect(p.worldFloats).toBe(WORLD_SIZE);
    expect(p.world.length).toBe(p.ticks * WORLD_SIZE);
    expect(p.rays).toHaveLength(9);
    const scene = p.scene as DrivingPreviewScene;
    expect(scene.blocks.length % 4).toBe(0);
    expect(scene.lamps.length).toBeGreaterThan(0);
    expect(scene.route.length).toBeGreaterThan(20);
    // The fitted area holds the whole route with room to spare.
    const b = p.bounds!;
    for (let k = 0; k < scene.route.length; k += 2) {
      expect(scene.route[k]).toBeGreaterThan(b.minX);
      expect(scene.route[k]).toBeLessThan(b.maxX);
      expect(scene.route[k + 1]).toBeGreaterThan(b.minY);
      expect(scene.route[k + 1]).toBeLessThan(b.maxY);
    }
  });
});
