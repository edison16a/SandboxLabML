'use client';

import { Tour, type TourStep } from '@/ui/tour/Tour';

const STEPS: TourStep[] = [
  {
    target: 'button[aria-label="Train"], button[aria-label="Pause"]',
    title: 'Start the arms race',
    body: 'Fifty hiders and fifty seekers start with random brains. Each generation plays four rounds, and both teams breed from their best.',
  },
  {
    target: '[aria-label="Arenas on screen"]',
    title: 'Watch every match at once',
    body: 'Show 1 to 50 arenas. Each border turns blue when the hider is ahead and red when the seeker is. Click an arena to fly in.',
  },
  {
    target: 'button[aria-label="Agent views"]',
    title: 'See what they see',
    body: 'In a focused arena, the corner views show each agent in first person. The red wedge is the field of view of the seeker.',
  },
  {
    target: '[aria-label="Simulation speed"]',
    title: 'Fast forward',
    body: 'Turbo trains flat out on every core and replays the latest round for you to watch.',
  },
  {
    target: 'aside',
    title: 'Both teams, side by side',
    body: 'Hidden time, fitness of both teams, their networks and model cards. Switch teams with the toggle at the top of each tab.',
  },
];

/** First-visit tour of the Hide and Seek lab. */
export function HideSeekTour() {
  return <Tour steps={STEPS} storageKey="sandboxlab.tour.hideseek" />;
}
