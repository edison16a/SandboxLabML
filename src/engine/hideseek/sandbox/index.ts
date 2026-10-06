/**
 * The Hide and Seek Sandbox: trained hiders and seekers, as many as the
 * user likes, in a preset room or one they drew. Built on the same world,
 * movement, grab, lock, ray and sight code as a training match.
 */
export * from './room';
export { fitRegion, MIN_SPAWN_SIDE, sanitizeRoom } from './validate';
export { sandboxSetup, type SandboxSetup } from './spawn';
export type { SandboxState } from './state';
export * from './snapshot';
export * from './types';
export { SandboxMatch } from './match';
