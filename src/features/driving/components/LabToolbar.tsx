'use client';

import { FlaskConical } from 'lucide-react';
import { LabToolbar as SharedToolbar } from '@/features/lab/components/LabToolbar';
import { LabHelpMenu } from '@/features/onboarding/LabHelpMenu';
import { DRIVING_TOUR } from '@/features/onboarding/drivingTour';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
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
  ['R', 'Restart the Sandbox trip'],
  ['Esc', 'Follow the leader again'],
];

/**
 * Opens and closes the Sandbox. It works before any training: the Sandbox
 * then starts on the shipped trained model.
 */
function SandboxButton() {
  const mode = useDrivingLab((s) => s.mode);
  const hasRun = useDrivingLab((s) => s.run !== null);
  const session = drivingSession();
  return (
    <Tooltip content="Drive champions or a trained model on any trip">
      <Button data-tour="sandbox" variant={mode === 'sandbox' ? 'primary' : 'outline'} onClick={() => void (mode === 'sandbox' ? session.exitSandbox() : session.enterSandbox())} disabled={!hasRun} aria-label="Sandbox">
        <FlaskConical />
        <span className="@max-[52rem]:hidden">Sandbox</span>
      </Button>
    </Tooltip>
  );
}

/** The shared lab toolbar with Driving's Sandbox button and help menu. */
export function LabToolbar({ onNewRun }: { onNewRun: () => void }) {
  return <SharedToolbar onNewRun={onNewRun} help={<LabHelpMenu tour={DRIVING_TOUR.id} shortcuts={SHORTCUTS} />} extra={<SandboxButton />} />;
}
