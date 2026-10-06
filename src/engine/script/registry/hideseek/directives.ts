import type { HideSeekDirective } from '../../../hideseek/trainer/types';
import type { GenerationView } from '../../generationTypes';
import { optional } from '../define';
import type { ParamDef } from '../types';

/** The Hide and Seek part of a generation's directives, created on first use. */
export function rules(v: unknown): HideSeekDirective {
  const d = (v as GenerationView).directives;
  return (d.hideseek ??= {});
}

/** The on or off switch of operators like keepChampions(). */
export const enabledParam = (summary: string): ParamDef => optional('enabled', 'bool', '', summary, true);
