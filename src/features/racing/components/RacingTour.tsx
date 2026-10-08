'use client';

import { Tour, type TourStep } from '@/ui/tour/Tour';

const STEPS: TourStep[] = [
  {
    target: '[data-tour="train"]',
    title: 'Start evolving',
    body: '100 cars with random brains take the track. The best ones breed the next generation.',
  },
  {
    target: '[data-tour="speed"]',
    title: 'Watch or fast-forward',
    body: '1x to 4x show every car drive. Turbo trains on every core and replays recent champions.',
  },
  {
    target: '[data-tour="view"]',
    title: 'Ghosts of past champions',
    body: 'Overlay shows earlier champions as ghosts, so you can see the laps improve.',
  },
  {
    target: '[data-tour="inputs"]',
    title: 'See what a car senses',
    body: 'Draws what the followed car feeds its brain. Click a car to follow it.',
  },
  {
    target: '[data-tour="panel"]',
    title: 'Charts, network and model card',
    body: 'Fitness over time, the champion brain firing live, and its size.',
  },
  {
    target: '[data-tour="sandbox"]',
    title: 'Experiment in the Sandbox',
    body: 'Race up to 16 champions on any track, or draw your own.',
  },
];

/** First-visit tour of the Racing lab. */
export function RacingTour({ openSignal }: { openSignal: number }) {
  return <Tour steps={STEPS} storageKey="sandboxlab.tour.racing" openSignal={openSignal} />;
}
