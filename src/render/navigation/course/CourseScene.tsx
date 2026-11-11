'use client';

import { useFrameCourse } from '../frame/useFrameCourse';
import { NavBackdrop } from '../scene/NavBackdrop';
import type { NavQualityTier } from '../types';
import { CourseBlocks } from './CourseBlocks';
import { CourseRoom } from './CourseRoom';
import { FinishBurst } from './FinishBurst';
import { FinishGate } from './FinishGate';
import { Movers } from './Movers';
import { SpikePads } from './SpikePads';
import { StartZone } from './StartZone';

/**
 * Everything on the course but the runners, the static parts rebuilt only
 * when the course changes: the room, the crates, the spikes, the movers on
 * their rails, the start pad and the finish gate, and the city round it.
 */
export function CourseScene({ tier, aoPass }: { tier: NavQualityTier; /** N8AO runs over the frame, so the baked shade can be lighter. */ aoPass: boolean }) {
  const course = useFrameCourse();
  const full = tier !== 'low';
  return (
    <group>
      <NavBackdrop course={course} />
      {course && (
        <>
          <CourseRoom course={course} ao={aoPass ? 0.3 : 0.5} />
          <StartZone course={course} />
          <CourseBlocks course={course} full={full} shadows={full} />
          <SpikePads course={course} shadows={full} />
          <Movers course={course} full={full} shadows={full} />
          <FinishGate course={course} shadows={full} />
        </>
      )}
      <FinishBurst />
    </group>
  );
}
