import { mixSeed, Rng } from '../../core/rng';
import { makeTickIO, type AgentController } from '../../env/types';
import type { SensorItem } from '../ast';
import type { CheckResult } from '../check/context';
import { sliceFor } from '../registry';
import type { ControllerContext, Reader, RngHolder } from '../registry/types';
import { eachBlock } from '../walk';
import { compileNum } from './expr';
import type { Frame } from './frame';
import { compileBlock } from './stmt';

interface CompiledSensor {
  read: Reader;
  lo: number;
  span: number;
}

/** Constant range of a script sensor, in base units. The checker guaranteed both ends are constants. */
export function sensorRange(check: CheckResult, s: SensorItem): [number, number] {
  const a = check.exprs.get(s.lo)?.value;
  const b = check.exprs.get(s.hi)?.value;
  return [typeof a === 'number' ? a : 0, typeof b === 'number' ? b : 1];
}

/**
 * Builds a fresh controller: its own local slots, its own random streams
 * and closures bound to this context's track. Building is cheap, and the
 * trainer makes one per episode batch.
 *
 * `rand()` in a tick draws from a stream owned by the agent, seeded from
 * the controller seed and the agent's own seed. Streams are kept per view
 * object in a WeakMap, so lookups allocate nothing, and a ghost replayed
 * alone draws exactly the numbers it drew during training.
 */
export function buildController<V>(check: CheckResult, ctx: ControllerContext): AgentController<V> {
  const holder: RngHolder = { rng: new Rng(ctx.seed) };
  const f: Frame = { check, bind: { controller: ctx, rng: holder }, slots: new Float64Array(Math.max(1, check.slotCount.tick)) };
  const tickBlock = eachBlock(check.program, 'tick');
  const run = tickBlock ? compileBlock(f, tickBlock) : null;
  const sensors: CompiledSensor[] = [];
  for (const item of check.program.items) {
    if (item.kind !== 'sensor') continue;
    const [lo, hi] = sensorRange(check, item);
    sensors.push({ read: compileNum(f, item.value), lo, span: hi - lo });
  }

  const usesRand = check.usesRand.tick;
  const agentSeed = sliceFor(check.env)?.agentSeed ?? (() => 0);
  const streams = new WeakMap<object, Rng>();
  const pick = (view: unknown) => {
    if (typeof view !== 'object' || view === null) return;
    let rng = streams.get(view);
    if (!rng) {
      rng = new Rng(mixSeed(ctx.seed, agentSeed(view)));
      streams.set(view, rng);
    }
    holder.rng = rng;
  };
  // Script sensors may not read the brain, so they get a blank io of their own.
  const sensorIO = makeTickIO(8, 8);
  const count = sensors.length;

  return {
    customSensorCount: count,
    sensors(view: V, out: Float64Array, offset: number) {
      if (usesRand) pick(view);
      for (let k = 0; k < count; k++) {
        const s = sensors[k];
        const x = (s.read(view, sensorIO) - s.lo) / s.span;
        out[offset + k] = x > 0 ? (x < 1 ? x : 1) : 0;
      }
    },
    tick(view: V, io) {
      if (usesRand) pick(view);
      if (run) run(view, io);
    },
  };
}
