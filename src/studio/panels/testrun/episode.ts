import { RACING_BLUEPRINTS } from '@/engine/blueprints/presets';
import { blueprintInputCount, blueprintShape } from '@/engine/blueprints/shape';
import type { RacingBlueprint } from '@/engine/blueprints/types';
import { Rng } from '@/engine/core/rng';
import { createGenome, createTemplate, InnovationTracker, Network, type Genome } from '@/engine/neat';
import { DEFAULT_CAR } from '@/engine/racing/car/params';
import { STATUS_DRIVING, type RacingCar } from '@/engine/racing/car/runtime';
import { RacingEnv, type RacingEnvOptions } from '@/engine/racing/env';
import { buildTrack } from '@/engine/racing/track/buildTrack';
import { BUILT_IN_TRACKS, findTrack } from '@/engine/racing/track/presets';
import { compileScript, lineOf } from '@/engine/script';
import { hostFor } from '@/engine/training/scriptHost';
import { measureScriptMicros } from './costBench';
import type { TestRunRequest, TestRunResult, TickLog } from './types';

const DEFAULT_BLUEPRINT = 'racing-standard';

function fail(message: string): TestRunResult {
  return { ok: false, message };
}

/** The genome and blueprint to drive with, or a message saying why this brain cannot run this script. */
function brainFor(req: TestRunRequest, brainId: string | null, sensors: number): { genome: Genome; blueprint: RacingBlueprint } | string {
  if (req.brain.kind === 'champion') {
    const { genome, blueprint } = req.brain;
    const expected = blueprintInputCount(blueprint) + sensors;
    if (genome.inputs.length !== expected) {
      return `This champion's brain has ${genome.inputs.length} inputs, but its blueprint with this script's sensors gives ${expected}. Use a random brain, or a champion trained with the same sensors.`;
    }
    return { genome, blueprint };
  }
  const id = brainId ?? DEFAULT_BLUEPRINT;
  const blueprint = RACING_BLUEPRINTS.find((b) => b.id === id);
  if (!blueprint) return `The brain ${id} is not a preset blueprint, so a random brain cannot be built for it here. Test with a champion trained with it instead.`;
  const tracker = new InnovationTracker();
  const template = createTemplate(blueprintShape(blueprint, sensors), tracker);
  return { genome: createGenome(template, tracker, new Rng(req.brain.seed), 0), blueprint };
}

function eventsOf(rc: RacingCar, wasOff: boolean): string[] {
  const out: string[] = [];
  if (rc.lapCompleted) out.push(`lap ${rc.lap}`);
  else if (rc.checkpointPassed) out.push('checkpoint');
  if (rc.offTrack && !wasOff) out.push('left the road');
  if (!rc.offTrack && wasOff) out.push('back on the road');
  if (rc.status !== STATUS_DRIVING) out.push(`stopped: ${rc.stopReason ?? 'done'}`);
  return out;
}

/**
 * One headless episode of a racing script with one car, logged tick by
 * tick, plus timing. It runs inside the Studio's test worker, and the
 * controller comes from hostFor, the same path training uses.
 */
export function runTestEpisode(req: TestRunRequest): TestRunResult {
  const compiled = compileScript(req.source);
  const header = compiled.program.header;
  if (header?.env === 'hideseek') return fail('This is a Hide and Seek script, so it plays a test match instead of a drive.');
  if (!compiled.script) {
    const first = compiled.diagnostics.find((d) => d.severity === 'error');
    return fail(first ? `Line ${lineOf(req.source, first.span.from)}: ${first.message}` : 'The script has errors. See the Problems tab.');
  }
  const script = compiled.script;
  const brain = brainFor(req, script.header.brain, script.sensors.length);
  if (typeof brain === 'string') return fail(brain);
  const host = hostFor(req.source);
  const track = buildTrack(findTrack(req.trackId) ?? BUILT_IN_TRACKS[0]);
  const champion = req.brain.kind === 'champion' ? req.brain : null;
  const options = (): RacingEnvOptions => ({
    track,
    car: champion?.car ?? DEFAULT_CAR,
    inputs: brain.blueprint.inputs,
    maxTime: champion?.maxTime ?? 60,
    controller: host.createRacingController(req.seed, track),
    customSensors: host.customSensors,
  });

  const env = new RacingEnv(options());
  env.reset([new Network(brain.genome)], [req.seed]);
  const cap = Math.ceil((champion?.maxTime ?? 60) * 30) + 2;
  const log: TickLog = { time: new Float32Array(cap), reward: new Float32Array(cap), total: new Float32Array(cap), speed: new Float32Array(cap), events: [] };
  const views: RacingCar[] = [];
  let n = 0;
  let last = 0;
  let wasOff = false;
  while (!env.done && n < cap) {
    env.step();
    const rc = env.cars[0];
    log.time[n] = rc.time;
    log.reward[n] = rc.fitness - last;
    log.total[n] = rc.fitness;
    log.speed[n] = rc.car.speed;
    for (const text of eventsOf(rc, wasOff)) log.events.push({ tick: n, text });
    if (n % 15 === 0 && views.length < 64 && rc.status === STATUS_DRIVING) views.push(structuredClone(rc));
    wasOff = rc.offTrack;
    last = rc.fitness;
    n++;
  }
  const rc = env.cars[0];

  let tickMicros = Infinity;
  for (let round = 0; round < 3; round++) {
    const timing = new RacingEnv(options());
    timing.reset([new Network(brain.genome)], [req.seed]);
    const t0 = performance.now();
    while (!timing.done) timing.step();
    tickMicros = Math.min(tickMicros, ((performance.now() - t0) * 1000) / Math.max(1, n));
  }
  const scriptMicros = measureScriptMicros(() => host.createRacingController(req.seed, track), views);
  const base = Math.max(0.05, tickMicros - scriptMicros);
  const trim = (a: Float32Array) => a.slice(0, n);
  return {
    ok: true,
    ticks: n,
    log: { time: trim(log.time), reward: trim(log.reward), total: trim(log.total), speed: trim(log.speed), events: log.events },
    stopReason: rc.stopReason ?? 'time',
    totalReward: rc.fitness,
    distance: rc.maxProgress,
    laps: rc.lap,
    scriptMicros,
    tickMicros,
    turboShare: base / (base + scriptMicros),
    blueprint: brain.blueprint.id,
  };
}
