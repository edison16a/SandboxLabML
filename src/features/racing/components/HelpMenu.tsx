'use client';

import { LabHelpMenu } from '@/features/onboarding/LabHelpMenu';
import { RACING_TOUR } from '@/features/onboarding/racingTour';

const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Train or pause'],
  ['R', 'Restart the race'],
  ['S', 'Run one generation'],
  ['1 to 5', 'Speed: 1x, 2x, 4x, Turbo, Max'],
  ['I', 'Inputs overlay'],
  ['V', 'Population, overlay or both'],
  ['C', 'Next camera'],
  ['N', 'New run'],
  ['Esc', 'Follow the leader again'],
];

/** Keyboard shortcuts and a way to replay the tour. */
export function HelpMenu() {
  return <LabHelpMenu tour={RACING_TOUR.id} shortcuts={SHORTCUTS} />;
}
