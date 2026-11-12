'use client';

import { useEffect, useState } from 'react';
import { NAV_FINISHED } from '@/engine/navigation/agent';
import { driverStatus, type DriverStatus } from '@/engine/hero/driver/status';
import type { DriveFeed } from '@/render/hero/driving/driveFeed';
import type { RunFeed } from '@/render/hero/navigation/runFeed';

/** The words for what the SUV is doing. */
const DRIVER_WORDS: Record<DriverStatus, string> = {
  drive: 'Driving',
  red: 'Waiting at a red light',
  slowing: 'Slowing for the light',
  person: 'Letting people cross',
  car: 'Waiting behind a car',
  left: 'Turning left',
  right: 'Turning right',
  arrived: 'Arrived',
};

/** Ticks a new status must hold before the card shows it, so a passing moment never makes the words flicker. */
const SETTLE = 12;
/** Frames between updates of the speed shown, so the number reads rather than spins. */
const SPEED_EVERY = 8;

/** A status line: what is happening and a number beside it. */
export interface StatusLine {
  status: string;
  detail: string;
}

/**
 * The SUV's status line, read from its learner after each frame that
 * moved the drive. React only hears of it when the words or the speed
 * shown change, a few times a second at most.
 */
export function useDriveStatus(feed: DriveFeed): StatusLine {
  const [line, setLine] = useState<StatusLine>({ status: DRIVER_WORDS.drive, detail: '0 km/h' });
  useEffect(() => {
    // The first read shows what is happening at once: on the poster capture nothing ticks after it.
    const first = driverStatus(feed.loop.learner);
    const seen = { shown: first, next: first, held: SETTLE, kmh: -1, frames: SPEED_EVERY };
    const read = () => {
      const l = feed.loop.learner;
      const now = driverStatus(l);
      seen.held = now === seen.next ? seen.held + 1 : 0;
      seen.next = now;
      seen.frames++;
      const kmh = Math.round(Math.abs(l.car.speed) * 3.6);
      const settled = (seen.held >= SETTLE || now === 'arrived') && now !== seen.shown;
      if (!settled && (kmh === seen.kmh || seen.frames < SPEED_EVERY) && seen.kmh >= 0) return;
      seen.frames = 0;
      if (settled) seen.shown = now;
      seen.kmh = kmh;
      setLine({ status: DRIVER_WORDS[seen.shown], detail: `${kmh} km/h` });
    };
    read();
    return feed.onTick(read);
  }, [feed]);
  return line;
}

/** The runner's status line: the course it is on and its clock, which stops at the line. */
export function useRunStatus(feed: RunFeed): StatusLine {
  const [line, setLine] = useState<StatusLine>({ status: '', detail: '' });
  useEffect(() => {
    let last = '';
    const read = () => {
      const a = feed.loop.agent;
      const done = a.status === NAV_FINISHED;
      const status = done ? 'Finished' : feed.loop.course.spec.name;
      const detail = done ? `${a.finishTime.toFixed(1)} s` : `${Math.floor(a.time)} s`;
      const key = status + detail;
      if (key === last) return;
      last = key;
      setLine({ status, detail });
    };
    read();
    return feed.onTick(read);
  }, [feed]);
  return line;
}
