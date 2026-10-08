'use client';

import { Tour, type TourStep } from '@/ui/tour/Tour';

const STEPS: TourStep[] = [
  {
    target: 'button[aria-label="Train"], button[aria-label="Pause"]',
    title: 'Start the arms race',
    body: '50 hiders and 50 seekers start with random brains. Each generation, both teams breed from their best.',
  },
  {
    target: '[aria-label="Arenas on screen"]',
    title: 'Watch every match at once',
    body: 'A border turns blue when the hider leads and red when the seeker does. Click an arena to fly in.',
  },
  {
    target: 'button[aria-label="Agent views"]',
    title: 'See what they see',
    body: 'Corner views show each agent in first person. The red wedge is what the seeker can see.',
  },
  {
    target: 'button[aria-label="Sandbox"]',
    title: 'Locks and ramps',
    body: 'Either team can lock a box, and only that team can free it. Seekers push ramps to walls and jump over.',
  },
  {
    target: '[aria-label="Simulation speed"]',
    title: 'Fast forward',
    body: 'Turbo trains on every core and replays the latest round.',
  },
  {
    target: 'aside',
    title: 'Both teams, side by side',
    body: 'Charts, networks and model cards for both teams. The toggle on each tab switches team.',
  },
];

/** First-visit tour of the Hide and Seek lab. */
export function HideSeekTour() {
  return <Tour steps={STEPS} storageKey="sandboxlab.tour.hideseek" />;
}
