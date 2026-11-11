import type { EpisodeTrainerState } from '@/engine/training/episodeTrainer';
import type { GenerationRecord } from '@/engine/training/records';

export type TrainingStatus = 'idle' | 'running' | 'paused' | 'error';

/** Everything the episode coordinator tells the main thread. */
export type CoordinatorEvent =
  | { type: 'status'; status: TrainingStatus }
  | { type: 'generation'; record: GenerationRecord }
  | { type: 'checkpoint'; generation: number; state: EpisodeTrainerState }
  | { type: 'live-start'; generation: number; speed: number }
  /** What the population trains on (Racing: the track). Sent on load and whenever a script or the curriculum changes it. */
  | { type: 'content'; content: unknown }
  | { type: 'error'; message: string };

export type EventSink = (event: CoordinatorEvent) => void;
