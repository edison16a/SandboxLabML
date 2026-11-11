'use client';

import { FlaskConical } from 'lucide-react';
import { LabToolbar as SharedToolbar } from '@/features/lab/components/LabToolbar';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { racingSession } from '../session/RacingSession';
import { useRacingLab } from '../state/labStore';
import { HelpMenu } from './HelpMenu';

/** Opens and closes the Sandbox, where stored champions race on any track. */
function SandboxButton() {
  const mode = useRacingLab((s) => s.mode);
  const hasRecords = useRacingLab((s) => s.records.length > 0);
  const session = racingSession();
  return (
    <Tooltip content="Race your champions on any track">
      <Button data-tour="sandbox" variant={mode === 'sandbox' ? 'primary' : 'outline'} onClick={() => void (mode === 'sandbox' ? session.exitSandbox() : session.enterSandbox())} disabled={!hasRecords} aria-label="Sandbox">
        <FlaskConical />
        <span className="@max-[52rem]:hidden">Sandbox</span>
      </Button>
    </Tooltip>
  );
}

/** The shared lab toolbar with Racing's Sandbox button and help menu. */
export function LabToolbar({ onNewRun }: { onNewRun: () => void }) {
  return <SharedToolbar onNewRun={onNewRun} help={<HelpMenu />} extra={<SandboxButton />} />;
}
