import { normalizeHideSeekInputs } from '../hideseek/inputConfig';
import type { Blueprint, HideSeekBlueprint } from './types';

/** A Hide and Seek blueprint read back from storage or a run, its inputs made whole (see normalizeHideSeekInputs). */
export function normalizeHideSeekBlueprint(b: HideSeekBlueprint): HideSeekBlueprint {
  const inputs = normalizeHideSeekInputs(b.inputs);
  return inputs === b.inputs ? b : { ...b, inputs };
}

/** Any stored blueprint made whole. Racing blueprints have nothing to fill in. */
export function normalizeBlueprint(b: Blueprint): Blueprint {
  return b.env === 'hideseek' ? normalizeHideSeekBlueprint(b) : b;
}
