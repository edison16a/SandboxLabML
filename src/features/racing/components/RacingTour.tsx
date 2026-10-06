'use client';

import { Tour, type TourStep } from '@/ui/tour/Tour';

const STEPS: TourStep[] = [
  {
    target: '[data-tour="train"]',
    title: 'Start evolving',
    body: 'Press Train and 100 cars with random brains take the track. The best ones breed the next generation. Space does the same.',
  },
  {
    target: '[data-tour="speed"]',
    title: 'Watch or fast-forward',
    body: '1x to 4x show every generation drive. Turbo trains on all your cores and loops the latest champions instead.',
  },
  {
    target: '[data-tour="view"]',
    title: 'Ghosts of past champions',
    body: 'Overlay shows champions from earlier generations as ghosts, so you can see the pack get faster and cleaner over time.',
  },
  {
    target: '[data-tour="inputs"]',
    title: 'See what a car senses',
    body: 'Draws the rays and readings the followed car feeds its brain. Click any car to follow it. Shortcut I.',
  },
  {
    target: '[data-tour="panel"]',
    title: 'Charts, network and model card',
    body: 'Fitness and species over time, the champion brain lighting up live, and how big it has grown.',
  },
  {
    target: '[data-tour="sandbox"]',
    title: 'Experiment in the Sandbox',
    body: 'Race up to 16 trained champions on any track or one you draw. Switch inputs off to see what they rely on. Training is never affected.',
  },
];

/** First-visit tour of the Racing lab. */
export function RacingTour({ openSignal }: { openSignal: number }) {
  return <Tour steps={STEPS} storageKey="sandboxlab.tour.racing" openSignal={openSignal} />;
}
