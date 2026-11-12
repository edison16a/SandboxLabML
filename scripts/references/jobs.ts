import { trainDrivingReference, type DrivingReferenceJob, type DrivingReferenceResult } from './driving/train';
import { trainNavigationReference, type NavigationReferenceJob, type NavigationReferenceResult } from './navigation/train';

/** Every kind of work the generator hands to a worker thread. */
export type Job = DrivingReferenceJob | NavigationReferenceJob;
export type JobResult = DrivingReferenceResult | NavigationReferenceResult;

/** Runs one job on this thread, whichever kind it is. */
export function runJob(job: Job): Promise<JobResult> {
  switch (job.kind) {
    case 'driving':
      return trainDrivingReference(job);
    case 'navigation':
      return trainNavigationReference(job);
  }
}
