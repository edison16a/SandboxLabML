import type { HideSeekLayoutId } from '@/engine/hideseek/layouts/types';
import type { HideSeekTrainerState } from '@/engine/hideseek/trainer/types';
import type { HideSeekRecord } from '@/engine/training/hideseekRecords';
import type { TrainingStatus } from './events';

/**
 * Everything the Hide and Seek coordinator tells the main thread. Kept apart
 * from the Racing events so neither lab has to handle the other's messages.
 */
export type HideSeekEvent =
  | { type: 'status'; status: TrainingStatus }
  /** A round is starting. `live` rounds stream every arena; headless ones do not. */
  | { type: 'round'; generation: number; round: number; rounds: number; layout: HideSeekLayoutId; matches: number; live: boolean; epoch: number }
  | { type: 'generation'; record: HideSeekRecord }
  | { type: 'checkpoint'; generation: number; state: HideSeekTrainerState }
  /** Something the user should know that does not stop training, such as a script falling back to built-in rewards. */
  | { type: 'notice'; message: string }
  | { type: 'error'; message: string };

export type HideSeekEventSink = (event: HideSeekEvent) => void;
