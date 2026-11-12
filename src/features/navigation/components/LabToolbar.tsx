'use client';

import { LabToolbar as SharedToolbar } from '@/features/lab/components/LabToolbar';
import type { SandboxSwitch } from '@/features/lab/components/SandboxButton';
import { NAVIGATION_TOUR } from '@/features/onboarding/navigationTour';
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

/** The Sandbox switch. It works before any training too, since it can play a model shipped with the app. */
function useSandboxSwitch(): SandboxSwitch {
  const open = useNavigationLab((s) => s.mode === 'sandbox');
  const disabled = useNavigationLab((s) => s.run === null);
  const session = navigationSession();
  return { open, disabled, hint: 'Run trained runners on any course, or draw your own', toggle: () => void (open ? session.exitSandbox() : session.enterSandbox()) };
}

/** The shared lab toolbar with Navigation's Sandbox, shortcuts and tour. */
export function LabToolbar({ onNewRun }: { onNewRun: () => void }) {
  return <SharedToolbar onNewRun={onNewRun} tour={NAVIGATION_TOUR.id} shortcuts={SHORTCUTS} sandbox={useSandboxSwitch()} />;
}
