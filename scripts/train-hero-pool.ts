/**
 * Shared parts of the hero scripts: command line options, and brains saved
 * to a file so a pick can run again without training again.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { DrivingInputConfig } from '../src/engine/driving/sensors/inputConfig';
import { findPresetBlueprint } from '../src/engine/blueprints/presets';
import type { DriverCandidate } from '../src/engine/hero/driver/pick';
import type { RunnerCandidate } from '../src/engine/hero/navigator/pick';
import type { NavigationInputConfig } from '../src/engine/navigation/sensors/inputConfig';
import { base64ToBytes, bytesToBase64, decodeGenome, encodeGenome } from '../src/engine/neat/serialize';

/** Command line options as `--name value` pairs. */
export function parseArgs(argv = process.argv.slice(2)): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) out[argv[i].slice(2)] = argv[i + 1] ?? '';
  return out;
}

/** A numeric option, or the fallback when it is not given. */
export function numberArg(args: Record<string, string>, name: string, fallback: number): number {
  return args[name] !== undefined ? Number(args[name]) : fallback;
}

/** A saved brain: its genome as base64 and everything else as it was. */
interface SavedBrain {
  label: string;
  blueprint: string;
  inputs: unknown;
  brainSeed: number;
  genome: string;
}

/** Writes trained Driving brains to a file that --pool reads back. */
export function saveDriverPool(path: string, candidates: readonly DriverCandidate[]): void {
  const brains: SavedBrain[] = candidates.map((c) => ({ label: c.label, blueprint: c.blueprint, inputs: c.inputs, brainSeed: c.brainSeed, genome: bytesToBase64(encodeGenome(c.genome)) }));
  writeFileSync(path, `${JSON.stringify({ env: 'driving', brains })}\n`);
}

type Json = Record<string, unknown>;

/** The brains in one file: a reference file's models, a reference generator dump's checkpoints, or a --save file. */
function driversIn(data: unknown): DriverCandidate[] {
  const out: DriverCandidate[] = [];
  const add = (label: string, blueprint: string, inputs: unknown, brainSeed: number, genome: string) =>
    out.push({ label, blueprint, inputs: inputs as DrivingInputConfig, brainSeed, genome: decodeGenome(base64ToBytes(genome)) });
  if (Array.isArray(data)) {
    for (const run of data as Json[]) {
      const job = run.job as Json;
      const champion = run.champion as Json;
      for (const c of (run.checkpoints as Json[]) ?? []) add(`${String(job.tier)} reference, seed ${String(job.seed)}, generation ${String(c.generation)}`, String(champion.blueprint), champion.inputs, Number(job.seed), String(c.genome));
    }
    return out;
  }
  const file = data as Json;
  for (const m of (file.models as Json[]) ?? []) add(`${String(m.tier)} reference model, seed ${String(m.seed)}, generation ${String(m.generation)}`, String(m.blueprint), m.inputs, Number(m.seed), String(m.genome));
  for (const b of (file.brains as SavedBrain[]) ?? []) add(b.label, b.blueprint, b.inputs, b.brainSeed, b.genome);
  return out;
}

/** Every Driving brain in the given files. */
export function loadDriverPool(paths: readonly string[]): DriverCandidate[] {
  return paths.flatMap((p) => driversIn(JSON.parse(readFileSync(p, 'utf8'))));
}

/** Writes trained Navigation brains to a file that --pool reads back. */
export function saveRunnerPool(path: string, candidates: readonly RunnerCandidate[]): void {
  const brains: SavedBrain[] = candidates.map((c) => ({ label: c.label, blueprint: c.blueprint, inputs: c.inputs, brainSeed: 0, genome: bytesToBase64(encodeGenome(c.genome)) }));
  writeFileSync(path, `${JSON.stringify({ env: 'navigation', brains })}\n`);
}

/** Every Navigation brain in the given files: a reference file's models (inputs from their preset brain) or a --save file. */
export function loadRunnerPool(paths: readonly string[]): RunnerCandidate[] {
  const out: RunnerCandidate[] = [];
  for (const path of paths) {
    const file = JSON.parse(readFileSync(path, 'utf8')) as Json;
    for (const m of (file.models as Json[]) ?? []) {
      const blueprint = findPresetBlueprint(String(m.blueprint));
      if (blueprint?.env !== 'navigation') continue;
      out.push({ label: `${String(m.tier)} reference model, seed ${String(m.seed)}, generation ${String(m.generation)}`, blueprint: blueprint.id, inputs: blueprint.inputs as NavigationInputConfig, genome: decodeGenome(base64ToBytes(String(m.genome))) });
    }
    for (const b of (file.brains as SavedBrain[]) ?? []) out.push({ label: b.label, blueprint: b.blueprint, inputs: b.inputs as NavigationInputConfig, genome: decodeGenome(base64ToBytes(b.genome)) });
  }
  return out;
}
