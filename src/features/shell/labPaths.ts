import type { EnvId } from '@/engine/env/types';

/** Where each environment's lab lives. The Hide and Seek route uses a hyphen, so the env id cannot double as the path. */
export const LAB_PATH: Record<EnvId, string> = { racing: '/lab/racing', hideseek: '/lab/hide-seek' };
