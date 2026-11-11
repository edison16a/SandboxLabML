'use client';

import { FlaskConical } from 'lucide-react';
import { LabToolbar as SharedToolbar } from '@/features/lab/components/LabToolbar';
import { LabHelpMenu } from '@/features/onboarding/LabHelpMenu';
import { NAVIGATION_TOUR } from '@/features/onboarding/navigationTour';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { navigationSession } from '../session/NavigationSession';
import { useNavigationLab } from '../state/labStore';

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
  ['R', 'In the Sandbox: restart'],
];

/** Opens and closes the Sandbox. It works before any training too, since it can play a model shipped with the app. */
function SandboxButton() {
  const mode = useNavigationLab((s) => s.mode);
  const hasRun = useNavigationLab((s) => s.run !== null);
  const session = navigationSession();
  return (
    <Tooltip content="Run trained runners on any course, or draw your own">
      <Button data-tour="sandbox" variant={mode === 'sandbox' ? 'primary' : 'outline'} onClick={() => void (mode === 'sandbox' ? session.exitSandbox() : session.enterSandbox())} disabled={!hasRun} aria-label="Sandbox">
        <FlaskConical />
        <span className="@max-[52rem]:hidden">Sandbox</span>
      </Button>
    </Tooltip>
  );
}

/** The shared lab toolbar with the Navigation Sandbox button and help menu. */
export function LabToolbar({ onNewRun }: { onNewRun: () => void }) {
  return <SharedToolbar onNewRun={onNewRun} help={<LabHelpMenu tour={NAVIGATION_TOUR.id} shortcuts={SHORTCUTS} />} extra={<SandboxButton />} />;
}
