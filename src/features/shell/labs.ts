import { Car, CarFront, Flag, Users, type LucideIcon } from 'lucide-react';
import type { EnvId } from '@/engine/env/types';
import type { BadgeTone } from '@/ui/primitives/Badge';

/** How the app shell shows one lab: its route, name, icon and badge color. */
export interface LabInfo {
  env: EnvId;
  /** The lab's route. The Hide and Seek route uses a hyphen, so the env id cannot double as the path. */
  path: string;
  label: string;
  icon: LucideIcon;
  tone: BadgeTone;
}

/**
 * Every lab in header order. This is the one entry a new lab adds to the
 * shell: the header nav, the Runs page filters and cards, and the Studio's
 * "train this script" link all read it.
 */
export const LABS: readonly LabInfo[] = [
  { env: 'racing', path: '/lab/racing', label: 'Racing', icon: Car, tone: 'accent' },
  { env: 'hideseek', path: '/lab/hide-seek', label: 'Hide and Seek', icon: Users, tone: 'orange' },
  { env: 'driving', path: '/lab/driving', label: 'Driving', icon: CarFront, tone: 'accent' },
  { env: 'navigation', path: '/lab/navigation', label: 'Navigation', icon: Flag, tone: 'accent' },
];

export function labOf(env: EnvId): LabInfo | undefined {
  return LABS.find((l) => l.env === env);
}

/** Where a lab lives. An env without a lab falls back to the Runs page. */
export function labPath(env: EnvId): string {
  return labOf(env)?.path ?? '/runs';
}
