import { trainRacingReference, type RacingReferenceJob, type RacingReferenceResult } from './racing/train';

/** Every kind of work the generator hands to a worker thread. */
export type Job = RacingReferenceJob;
export type JobResult = RacingReferenceResult;

/** Runs one job on this thread, whichever kind it is. */
export function runJob(job: Job): Promise<JobResult> {
  switch (job.kind) {
    case 'racing':
      return trainRacingReference(job);
  }
}
