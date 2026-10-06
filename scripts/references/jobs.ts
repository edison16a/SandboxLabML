import { runHideSeekExam, type HideSeekExamJob, type HideSeekExamResult } from './hideseek/exam';
import { trainHideSeekReference, type HideSeekTrainJob, type HideSeekTrainResult } from './hideseek/train';
import { runHideSeekYardstick, type HideSeekYardstickJob, type HideSeekYardstickResult } from './hideseek/yardstick';
import { trainRacingReference, type RacingReferenceJob, type RacingReferenceResult } from './racing/train';

/** Every kind of work the generator hands to a worker thread. */
export type Job = RacingReferenceJob | HideSeekTrainJob | HideSeekExamJob | HideSeekYardstickJob;
export type JobResult = RacingReferenceResult | HideSeekTrainResult | HideSeekExamResult | HideSeekYardstickResult;

/** Runs one job on this thread, whichever kind it is. */
export function runJob(job: Job): Promise<JobResult> {
  switch (job.kind) {
    case 'racing':
      return trainRacingReference(job);
    case 'hideseek-train':
      return trainHideSeekReference(job);
    case 'hideseek-exam':
      return runHideSeekExam(job);
    case 'hideseek-yardstick':
      return runHideSeekYardstick(job);
  }
}
