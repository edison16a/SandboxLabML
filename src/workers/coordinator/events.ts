import type { GenerationRecord } from '@/engine/training/records';
import type { RacingTrainerState } from '@/engine/training/racingTrainer';
import type { TrackSpec } from '@/engine/racing/track/types';

export type TrainingStatus = 'idle' | 'running' | 'paused' | 'error';

/** Everything the coordinator tells the main thread. */
export type CoordinatorEvent =
  | { type: 'status'; status: TrainingStatus }
  | { type: 'generation'; record: GenerationRecord }
  | { type: 'checkpoint'; generation: number; state: RacingTrainerState }
  | { type: 'live-start'; generation: number; speed: number }
  /** Sent on load and whenever a script switches the track. */
  | { type: 'track'; spec: TrackSpec }
  | { type: 'error'; message: string };

export type EventSink = (event: CoordinatorEvent) => void;
