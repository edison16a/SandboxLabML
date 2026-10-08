'use client';

import { HIDE_SEEK_TOUR } from '@/features/onboarding/hideSeekTour';
import { LabHelpMenu } from '@/features/onboarding/LabHelpMenu';

const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Train or pause. In the Sandbox, play or pause the match'],
  ['R', 'Restart the Sandbox match'],
  ['S', 'Run one generation'],
  ['1 to 5', 'Speed: 1x, 2x, 4x, Turbo, Max'],
  ['G', 'Arenas on screen'],
  ['I', 'Inputs overlay'],
  ['C', 'Next camera'],
  ['N', 'New run'],
  ['Esc', 'Back out of photo mode or a focused arena'],
];

/** Keyboard shortcuts of the Hide and Seek lab and a way to replay its tour. */
export function HsHelpMenu() {
  return <LabHelpMenu tour={HIDE_SEEK_TOUR.id} shortcuts={SHORTCUTS} />;
}
