import type { ComponentType } from 'react';
import type { Blueprint } from '@/engine/blueprints/types';
import type { EnvId } from '@/engine/env/types';
import { HideSeekBlueprintForm } from './HideSeekBlueprintForm';
import { NavigationBlueprintForm } from './NavigationBlueprintForm';
import { RacingBlueprintForm } from './RacingBlueprintForm';

/** A blueprint form edits a draft of its env's blueprint. The dialog only hands it blueprints of that env. */
export type BlueprintFormComponent = ComponentType<{ value: Blueprint; onChange: (b: Blueprint) => void }>;

/**
 * The sensor form of each env, which "Customize" in a new run dialog and
 * "Grow this brain" open. This is the one entry a new env adds here: its
 * form toggles its sensor groups and composes BrainStartFields for the
 * noise and how the brain starts. An env without a row gets
 * BrainStartFields alone.
 */
export const BLUEPRINT_FORMS: Partial<Record<EnvId, BlueprintFormComponent>> = {
  racing: RacingBlueprintForm as BlueprintFormComponent,
  hideseek: HideSeekBlueprintForm as BlueprintFormComponent,
  // The dialog only hands a form blueprints of its env, whose inputs are that env's own config.
  navigation: NavigationBlueprintForm as unknown as BlueprintFormComponent,
};
