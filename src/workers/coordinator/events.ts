import type { GenerationRecord } from '@/engine/training/records';
import type { RacingTrainerState } from '@/engine/training/racingTrainer';

export type TrainingStatus = 'idle' | 'running' | 'paused' | 'error';

/** Everything the coordinator tells the main thread. */
export type CoordinatorEvent =
  | { type: 'status'; status: TrainingStatus }
  | { type: 'generation'; record: GenerationRecord }
  | { type: 'checkpoint'; generation: number; state: RacingTrainerState }
  | { type: 'live-start'; generation: number; speed: number }
  | { type: 'error'; message: string };

export type EventSink = (event: CoordinatorEvent) => void;
