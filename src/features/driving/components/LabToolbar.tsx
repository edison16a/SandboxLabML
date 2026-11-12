'use client';

import { LabToolbar as SharedToolbar } from '@/features/lab/components/LabToolbar';
import type { SandboxSwitch } from '@/features/lab/components/SandboxButton';
import { DRIVING_TOUR } from '@/features/onboarding/drivingTour';
import { drivingSession } from '../session/DrivingSession';
import { useDrivingLab } from '../state/labStore';

const SHORTCUTS: Array<[string, string]> = [
  ['Space', 'Train or pause'],
  ['S', 'Run one generation'],
  ['1 to 5', 'Speed: 1x, 2x, 4x, Turbo, Max'],
  ['I', 'Inputs overlay'],
  ['V', 'Population, overlay or both'],
  ['C', 'Next camera'],
  ['N', 'New run'],
  ['Esc', 'Follow the leader again'],
  ['Space', 'In the Sandbox: play or pause'],
  ['R', 'In the Sandbox: restart the trip'],
];

/** The Sandbox switch. It works before any training: the Sandbox then starts on the shipped trained model. */
function useSandboxSwitch(): SandboxSwitch {
  const open = useDrivingLab((s) => s.mode === 'sandbox');
  const disabled = useDrivingLab((s) => s.run === null);
  const session = drivingSession();
  return { open, disabled, hint: 'Drive champions or a trained model on any trip', toggle: () => void (open ? session.exitSandbox() : session.enterSandbox()) };
}

/** The shared lab toolbar with Driving's Sandbox, shortcuts and tour. */
export function LabToolbar({ onNewRun }: { onNewRun: () => void }) {
  return <SharedToolbar onNewRun={onNewRun} tour={DRIVING_TOUR.id} shortcuts={SHORTCUTS} sandbox={useSandboxSwitch()} />;
}
