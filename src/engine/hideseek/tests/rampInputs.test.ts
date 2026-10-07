import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { SEEKER } from '../agents/agent';
import { setBoxLock } from '../agents/lock';
import { hideSeekInputCount, normalizeHideSeekInputs, STANDARD_HIDESEEK_INPUTS, type HideSeekInputConfig } from '../inputConfig';
import { hideSeekInputSchema } from '../sensing/inputSchema';
import { HideSeekObserver } from '../sensing/observe';
import { createArenaPool, type ArenaPool } from '../world/pool';
import { CLIMB_RULES, placeRamp, record } from './climbHelpers';
import { scripted, scriptedMatch } from './helpers';

let pool: ArenaPool;
beforeAll(async () => {
  pool = await createArenaPool();
});
afterAll(() => pool.dispose());

const P = CLIMB_RULES;
const size = P.arena.size;
const keys = hideSeekInputSchema(STANDARD_HIDESEEK_INPUTS, P).map((s) => s.key);
const at = (key: string) => keys.indexOf(key);

describe('ramp inputs', () => {
  it('give the nearest ramp in the agent frame, the facing uphill, the lock from each side and the elevation', () => {
    const m = scriptedMatch(pool, 'open', scripted(() => ({})), scripted(() => ({ move: 1 })), P);
    placeRamp(m, 0, 0, 0);
    m.moveAgent('hider', -3, 2, 0);
    m.moveAgent('seeker', -1.5, 0, 0);
    // The seekers own the lock on the ramp, and the seeker climbs it.
    setBoxLock(m.state, 4, SEEKER);
    record(m, 1, 20);
    expect(m.seeker.climbing).toBe(true);
    const h = m.observation(0);
    expect(h[at('ramp:ahead')]).toBeCloseTo(3 / size, 6);
    // The ramp is 2 m toward -z, which is to the left of an agent facing +x.
    expect(h[at('ramp:right')]).toBeCloseTo(-2 / size, 6);
    expect(h[at('ramp:distance')]).toBeCloseTo(Math.hypot(3, 2) / size, 6);
    expect(h[at('ramp:uphill')]).toBeCloseTo(1, 6);
    expect(h[at('ramp:lock')]).toBe(-1);
    expect(h[at('ramp:elevation')]).toBe(0);
    const s = m.observation(1);
    expect(s[at('ramp:lock')]).toBe(1);
    expect(s[at('ramp:uphill')]).toBeCloseTo(1, 9);
    expect(s[at('ramp:elevation')]).toBeCloseTo(m.seeker.elevation / P.box.ramp.height, 9);
    expect(s[at('ramp:elevation')]).toBeGreaterThan(0.2);
    m.release();
  });

  it('keep the nearest box inputs for cubes and planks', () => {
    const m = scriptedMatch(pool, 'open', scripted(() => ({})), scripted(() => ({})), P);
    // The ramp is right next to the hider, nearer than any crate.
    placeRamp(m, -2, 0, 0);
    m.moveAgent('hider', -2, 1.5, 0);
    m.step();
    const cfg: HideSeekInputConfig = { ...STANDARD_HIDESEEK_INPUTS, nearestBoxes: 5 };
    const out = new Float64Array(hideSeekInputCount(cfg));
    new HideSeekObserver(cfg, P).write(m.state, 0, out, null);
    const first = hideSeekInputSchema(cfg, P).findIndex((s) => s.key === 'box:1:ahead');
    const slots = Array.from({ length: 5 }, (_, k) => Array.from(out.slice(first + 4 * k, first + 4 * k + 4)));
    const crates = m.state.boxes.filter((b) => b.kind !== 'ramp').map((b) => Math.hypot(b.x - m.hider.x, b.z - m.hider.z) / size);
    expect(slots.slice(0, 4).map((s) => s[2]).sort()).toEqual(crates.sort());
    // Four crates fill four slots, and the fifth reads as far away.
    expect(slots[4]).toEqual([0, 0, 1, 0]);
    m.release();
  });

  it('read as off for configs saved before ramps', () => {
    const { ramp: _ramp, ...old } = STANDARD_HIDESEEK_INPUTS;
    const stored = old as HideSeekInputConfig;
    const read = normalizeHideSeekInputs(stored);
    expect(read.ramp).toBe(false);
    expect(hideSeekInputCount(read)).toBe(hideSeekInputCount(STANDARD_HIDESEEK_INPUTS) - 6);
    expect(normalizeHideSeekInputs(STANDARD_HIDESEEK_INPUTS)).toBe(STANDARD_HIDESEEK_INPUTS);
  });
});
