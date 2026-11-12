import { CarFront, Flag, type LucideIcon } from 'lucide-react';
import type { EnvId } from '@/engine/env/types';
import type { BadgeTone } from '@/ui/primitives/Badge';

/** How the app shell shows one lab: its route, name, icon and badge color. */
export interface LabInfo {
  env: EnvId;
  /** The lab's route. */
  path: string;
  label: string;
  icon: LucideIcon;
  tone: BadgeTone;
}

/**
 * Every lab in header order. This is the one entry a new lab adds to the
 * shell: the header nav, the Runs page filters and cards, the Studio's env
 * lists and its "train this script" link all read it. An env the engine
 * knows without a row here shows nowhere, and its stored runs and scripts
 * stay hidden.
 */
export const LABS: readonly LabInfo[] = [
  { env: 'driving', path: '/lab/driving', label: 'Driving', icon: CarFront, tone: 'accent' },
  { env: 'navigation', path: '/lab/navigation', label: 'Navigation', icon: Flag, tone: 'accent' },
];

export function labOf(env: string): LabInfo | undefined {
  return LABS.find((l) => l.env === env);
}

/** True when this version has a lab for `env`. Stored runs and scripts of any other env stay hidden. */
export function isLabEnv(env: string): env is EnvId {
  return labOf(env) !== undefined;
}

/** Where a lab lives. An env without a lab falls back to the Runs page. */
export function labPath(env: EnvId): string {
  return labOf(env)?.path ?? '/runs';
}
