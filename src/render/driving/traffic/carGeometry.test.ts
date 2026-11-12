import { describe, expect, it } from 'vitest';
import { CAR_SEDAN } from '@/engine/driving/world/state';
import { TRAFFIC_DETAIL } from './body/detail';
import { carBodyGeometry } from './carGeometry';
import { CAR_SHAPES } from './shapes';

describe('traffic body cache', () => {
  it('builds a body once and hands out copies the caller owns', () => {
    const shape = CAR_SHAPES[CAR_SEDAN];
    const a = carBodyGeometry(shape, TRAFFIC_DETAIL.low);
    const start = performance.now();
    const b = carBodyGeometry(shape, TRAFFIC_DETAIL.low);
    // A second mount only copies arrays; a fresh build takes tens of milliseconds even on Low.
    expect(performance.now() - start).toBeLessThan(20);
    expect(b).not.toBe(a);
    expect(b.attributes.position.array).not.toBe(a.attributes.position.array);
    expect(Array.from(b.attributes.position.array)).toEqual(Array.from(a.attributes.position.array));
    // A caller may add its own attributes and dispose its copy without touching the next one.
    a.deleteAttribute('lamp');
    a.dispose();
    const c = carBodyGeometry(shape, TRAFFIC_DETAIL.low);
    expect(c.attributes.lamp).toBeDefined();
    b.dispose();
    c.dispose();
  });
});
