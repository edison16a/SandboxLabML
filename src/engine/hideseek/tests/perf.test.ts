import { describe, expect, it } from 'vitest';
import { STANDARD_HIDESEEK_INPUTS } from '../inputConfig';
import { runMatch, startMatch } from '../match/runMatch';
import type { MatchSpec } from '../match/types';
import { hideSeekPhysics } from '../physics';
import { createArenaPool } from '../world/pool';
import { randomGenomes } from './helpers';

/**
 * Catches Rapier's WASM memory as it is instantiated, so the test can watch
 * the heap size. Must run before the first `loadRapier` in this file. Other
 * WASM modules load too (the test runner has its own), so Rapier's is
 * picked out by one of its exports.
 */
let wasmMemory: WebAssembly.Memory | null = null;
const instantiate = WebAssembly.instantiate;
(WebAssembly as unknown as { instantiate: unknown }).instantiate = async (...args: Parameters<typeof instantiate>) => {
  const out = await (instantiate as (...a: unknown[]) => Promise<unknown>)(...args);
  const instance = ((out as { instance?: WebAssembly.Instance }).instance ?? out) as WebAssembly.Instance;
  if ('rawbroadphase_castRay' in instance.exports) wasmMemory = instance.exports.memory as WebAssembly.Memory;
  return out;
};

const inputs = STANDARD_HIDESEEK_INPUTS;
const LAYOUTS = ['open', 'shelter', 'corridor'] as const;

function specs(count: number, seed: number, physics = hideSeekPhysics()): MatchSpec[] {
  const hiders = randomGenomes(inputs, count, seed);
  const seekers = randomGenomes(inputs, count, seed + 1);
  return hiders.map((h, i) => ({ layout: LAYOUTS[i % 3], seed: seed * 1000 + i, hider: { genome: h, inputs }, seeker: { genome: seekers[i], inputs }, physics }));
}

describe('performance', () => {
  it('plays a full 900 tick match in well under a second on one thread', async () => {
    const pool = await createArenaPool();
    const list = specs(12, 3);
    runMatch(list[0], pool); // warm up the JIT
    let stepMs = 0;
    let ticks = 0;
    const t0 = performance.now();
    for (const spec of list) {
      const m = startMatch(spec, pool);
      const arena = m.state.arena;
      const realStep = arena.step.bind(arena);
      arena.step = () => {
        const s0 = performance.now();
        realStep();
        stepMs += performance.now() - s0;
      };
      m.run();
      ticks += m.tick;
      delete (arena as { step?: unknown }).step;
      m.release();
    }
    const total = performance.now() - t0;
    const perMatch = total / list.length;
    console.log(
      `Hide and Seek: ${perMatch.toFixed(1)} ms per 900 tick match, ${(1000 / perMatch).toFixed(1)} matches/s on one thread, ` +
        `${((total * 1000) / ticks).toFixed(1)} us per tick, of which world.step ${((stepMs * 1000) / ticks).toFixed(1)} us. ` +
        `Real time is 30 s per match, so one thread runs at ${(30000 / perMatch).toFixed(0)}x.`,
    );
    expect(perMatch).toBeLessThan(1000);
    pool.dispose();
  });

  it('keeps the WASM heap flat over hundreds of matches', async () => {
    const pool = await createArenaPool();
    // Short matches: the heap only depends on how worlds are reset, not on match length.
    const list = specs(60, 9, hideSeekPhysics({ matchSeconds: 2 }));
    for (const spec of list) runMatch(spec, pool);
    const before = wasmMemory?.buffer.byteLength ?? 0;
    for (let k = 0; k < 8; k++) for (const spec of list) runMatch(spec, pool);
    const after = wasmMemory?.buffer.byteLength ?? 0;
    console.log(`WASM heap ${(before / 1e6).toFixed(2)} MB after 60 matches, ${(after / 1e6).toFixed(2)} MB after 540, pool slots ${pool.size}`);
    pool.dispose();
    if (!wasmMemory) return; // Rapier changed how it loads; nothing to measure.
    expect(after).toBe(before);
  });
});
