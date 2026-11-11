import type { DrivingInputConfig } from '../../driving/sensors/inputConfig';
import { REFERENCE_TIERS, referencesPath } from '../references';
import type { ReferenceTier } from '../types';

/**
 * A trained Driving champion shipped with the reference curves: the final
 * champion of a typical reference run of one preset. The Sandbox drives it
 * so a newcomer sees a skilled SUV without training one first. Its inputs
 * travel with it, so it plays whatever brain the open run uses.
 */
export interface DrivingReferenceModel {
  tier: ReferenceTier;
  /** The training seed and generation it comes from. */
  seed: number;
  generation: number;
  /** Its benchmark score, 0 to 100. */
  score: number;
  /** The preset brain it was trained as, such as driving-standard. */
  blueprint: string;
  inputs: DrivingInputConfig;
  /** The genome in the binary format, as base64. */
  genome: string;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Checks the parts of an input config the player reads first. The genome decoder checks the rest when it loads. */
function isInputs(v: unknown): v is DrivingInputConfig {
  return isObj(v) && isObj(v.lidar) && isNum(v.lidar.count) && isNum(v.lidar.range) && isNum(v.lidar.fov) && isNum(v.noise);
}

function isModel(v: unknown): v is DrivingReferenceModel {
  if (!isObj(v)) return false;
  return REFERENCE_TIERS.includes(v.tier as ReferenceTier) && isNum(v.seed) && isNum(v.generation) && isNum(v.score) && typeof v.blueprint === 'string' && typeof v.genome === 'string' && isInputs(v.inputs);
}

/**
 * The models of a parsed Driving reference file, best score first. They sit
 * beside the shared fields (which parseReferences reads), so a file
 * without them, or with a broken one, simply has fewer models.
 */
export function parseDrivingModels(data: unknown): DrivingReferenceModel[] {
  if (!isObj(data) || data.env !== 'driving' || !Array.isArray(data.models)) return [];
  return data.models.filter(isModel).sort((a, b) => b.score - a.score);
}

/** The shipped Driving models, or none when the file cannot be loaded. Runs in the browser and in workers. */
export async function loadDrivingModels(): Promise<DrivingReferenceModel[]> {
  try {
    const res = await fetch(referencesPath('driving'));
    return res.ok ? parseDrivingModels(await res.json()) : [];
  } catch {
    return [];
  }
}
