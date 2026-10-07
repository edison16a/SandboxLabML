import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { jumpTicks } from '../agents/climb/jump';
import { createArenaPool, type ArenaPool } from '../world/pool';
import { CLIMB_RULES, placeBox, placeRamp, RAMP, record } from './climbHelpers';
import { idle, scripted, scriptedMatch } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

const P = CLIMB_RULES;
const L = P.box.ramp.length;
const forward = () => scripted(() => ({ move: 1 }));

describe('jumping off a ramp', () => {
  it('a seeker runs up a ramp set against the shelter wall, vaults it and lands inside', () => {
    const m = scriptedMatch(pool, 'shelter', idle(), forward(), P);
    m.moveAgent('hider', 6, 6, 0);
    // The half room is x < -3 and z < -3. The lip rests against its east wall, which spans x -3.1 to -2.9.
    placeRamp(m, -2.9 + L / 2 + 0.05, -6.5, Math.PI, true);
    m.moveAgent('seeker', 1.5, -6.5, Math.PI);
    const frames = record(m, 1, 150);
    const mounted = frames.findIndex((f) => f.climbing);
    const tookOff = frames.findIndex((f) => f.airborne);
    const landed = frames.findIndex((f) => f.justVaulted);
    expect(mounted).toBeGreaterThan(0);
    expect(tookOff).toBeGreaterThan(mounted);
    expect(landed - tookOff).toBe(jumpTicks(P));
    // Over the wall the arc clears its top.
    const over = frames.filter((f) => f.airborne && f.x < -2.9 && f.x > -3.1);
    expect(over.length).toBeGreaterThan(0);
    for (const f of over) expect(f.elevation).toBeGreaterThan(P.arena.wallHeight);
    // The arc tops out a clearance above the wall, give or take the tick it is sampled at.
    const top = Math.max(...frames.map((f) => f.elevation));
    expect(top).toBeLessThanOrEqual(P.arena.wallHeight + P.climb.clearance);
    expect(top).toBeGreaterThan(P.arena.wallHeight + P.climb.clearance - 0.02);
    const end = m.seeker;
    expect(end.x).toBeLessThan(-3.1 - P.agent.radius);
    expect(end.z).toBeLessThan(-3);
    expect(end.elevation).toBe(0);
    expect(end.climbing || end.airborne).toBe(false);
    expect(end.vaults).toBe(1);
    expect(m.result().seekerVaults).toBe(1);
    // It is back among solid things: a few more ticks of driving into the inner side of the wall keep it inside.
    m.moveAgent('seeker', end.x, end.z, 0);
    record(m, 1, 30);
    expect(m.seeker.x).toBeLessThan(-3.1);
    m.release();
  });

  it('hops down off a lip with nothing ahead, no vault', () => {
    const m = scriptedMatch(pool, 'open', idle(), forward(), P);
    m.moveAgent('hider', 8, 8, 0);
    placeRamp(m, 0, 0, 0, true);
    m.moveAgent('seeker', -3, 0, 0);
    const frames = record(m, 1, 120);
    const tookOff = frames.findIndex((f) => f.airborne);
    const landedAt = frames.findIndex((f, k) => k > tookOff && !f.airborne);
    expect(tookOff).toBeGreaterThan(0);
    expect(landedAt - tookOff).toBe(jumpTicks(P));
    expect(frames.some((f) => f.justVaulted)).toBe(false);
    const top = Math.max(...frames.map((f) => f.elevation));
    expect(top).toBeLessThanOrEqual(P.box.ramp.height + P.climb.clearance);
    expect(top).toBeGreaterThan(P.box.ramp.height + P.climb.clearance - 0.02);
    // It lands as close past the lip as its body allows, then drives on.
    const spot = m.state.controls[1].climb.toX;
    expect(spot).toBeGreaterThan(L / 2 + P.agent.radius);
    expect(spot).toBeLessThan(L / 2 + P.agent.radius + 0.15);
    expect(frames[landedAt].x).toBeGreaterThan(spot);
    expect(m.seeker.vaults).toBe(0);
    m.release();
  });

  it('waits at the lip when no landing spot is free in range, and can back down', () => {
    const hider = idle();
    const seeker = scripted((_, t) => ({ move: t < 100 ? 1 : -1 }));
    const m = scriptedMatch(pool, 'shelter', hider, seeker, P);
    m.moveAgent('hider', 6, 6, 0);
    placeRamp(m, -2.9 + L / 2 + 0.05, -6.5, Math.PI, true);
    // Two cubes behind the wall fill every spot out to the jump range.
    placeBox(m, 0, -4.2, -6.5);
    placeBox(m, 1, -5.3, -6.5);
    m.moveAgent('seeker', 1.5, -6.5, Math.PI);
    const up = record(m, 1, 100);
    expect(up.some((f) => f.airborne)).toBe(false);
    const last = up[up.length - 1];
    expect(last.climbing).toBe(true);
    expect(last.elevation).toBeCloseTo(P.box.ramp.height, 6);
    // Backing down runs at half the climbing speed, so the slope takes a little over two seconds.
    const down = record(m, 1, 90);
    expect(down.some((f) => f.airborne)).toBe(false);
    expect(m.seeker.climbing).toBe(false);
    expect(m.seeker.x).toBeGreaterThan(m.state.boxes[RAMP].x + L / 2);
    m.release();
  });

  it('never jumps the outer walls', () => {
    const m = scriptedMatch(pool, 'open', idle(), forward(), P);
    m.moveAgent('hider', -8, -8, 0);
    // The lip rests against the east outer wall.
    placeRamp(m, 10 - L / 2 - 0.05, 0, 0, true);
    m.moveAgent('seeker', 4, 0, 0);
    const frames = record(m, 1, 150);
    expect(frames.some((f) => f.climbing)).toBe(true);
    expect(frames.some((f) => f.airborne)).toBe(false);
    for (const f of frames) expect(f.x).toBeLessThan(10);
    expect(m.seeker.climbing).toBe(true);
    m.release();
  });
});
