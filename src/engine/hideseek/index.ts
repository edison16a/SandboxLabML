/**
 * The Hide and Seek engine: a 1 v 1 match on Rapier physics, its sensors,
 * rewards and snapshots, and the co-evolution trainer. No DOM and no
 * rendering, so it runs the same in the page, a worker or Node.
 */
export * from './inputConfig';
export * from './physics';
export * from './frame';
export * from './layouts';
export * from './agents/agent';
export * from './sensing/inputSchema';
export { hideSeekRayAngles, SensorRays } from './sensing/rays';
export { HideSeekObserver } from './sensing/observe';
export { SightLines } from './sensing/vision';
export * from './rewards';
export { scriptedSeekerController } from './scriptedSeeker';
export { scriptedHiderController } from './scriptedHider';
export * from './snapshot';
export * from './match/types';
export type { AgentControl, BoxState, MatchState, MatchTally, PlayState } from './match/state';
export { matchPrepTicks } from './match/state';
export { HideSeekMatch } from './match/match';
export { runMatch, startMatch } from './match/runMatch';
export { BOX_MOVED_DISTANCE } from './match/result';
export { ArenaWorld } from './world/arena';
export { RoomWorld, type PlanarVelocity } from './world/room';
export { ArenaPool, createArenaPool } from './world/pool';
export { loadRapier, type Rapier } from './world/rapier';
export * from './trainer/types';
export { HideSeekTrainer, resolveTrainerOptions, type ControllersFor, type TeamPlans } from './trainer/trainer';
export { DEFAULT_HIDESEEK_SETUP, HIDESEEK_SETUPS, MAX_ROUNDS, type HideSeekSetup } from './trainer/setups';
export { MAX_HALL_OF_FAME, MAX_PREP_SECONDS, readHideSeekDirective } from './trainer/directive';
export type { HideSeekGenerationScript, TeamGenerationContext } from './trainer/generationScript';
export { HallOfFame } from './trainer/hallOfFame';
export { planRounds, type ScheduleInput } from './trainer/schedule';
export { scoreGeneration, type GenerationScores } from './trainer/scoring';
