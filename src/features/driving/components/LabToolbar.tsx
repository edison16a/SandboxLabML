'use client';

import { LabToolbar as SharedToolbar } from '@/features/lab/components/LabToolbar';
import { LabHelpMenu } from '@/features/onboarding/LabHelpMenu';
import { DRIVING_TOUR } from '@/features/onboarding/drivingTour';

const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Train or pause'],
  ['S', 'Run one generation'],
  ['1 to 5', 'Speed: 1x, 2x, 4x, Turbo, Max'],
  ['I', 'Inputs overlay'],
  ['V', 'Population, overlay or both'],
  ['C', 'Next camera'],
  ['N', 'New run'],
  ['Esc', 'Follow the leader again'],
];

/** The shared lab toolbar with Driving's help menu. */
export function LabToolbar({ onNewRun, extra }: { onNewRun: () => void; extra?: React.ReactNode }) {
  return <SharedToolbar onNewRun={onNewRun} help={<LabHelpMenu tour={DRIVING_TOUR.id} shortcuts={SHORTCUTS} />} extra={extra} />;
}
