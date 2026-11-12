'use client';

import { FlaskConical } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Tooltip } from '@/ui/primitives/Tooltip';

/** A lab's Sandbox switch, as the toolbar and its phone menu show it. */
export interface SandboxSwitch {
  open: boolean;
  /** True before the lab has a run to open the Sandbox for. */
  disabled: boolean;
  /** What the Sandbox does, as the button's tooltip. */
  hint: string;
  toggle(): void;
}

/** Opens and closes the Sandbox. It lights up while the Sandbox is open. */
export function SandboxButton({ sandbox }: { sandbox: SandboxSwitch }) {
  return (
    <Tooltip content={sandbox.hint}>
      <Button data-tour="sandbox" variant={sandbox.open ? 'primary' : 'outline'} onClick={sandbox.toggle} disabled={sandbox.disabled} aria-label="Sandbox">
        <FlaskConical />
        <span className="@max-[52rem]:hidden">Sandbox</span>
      </Button>
    </Tooltip>
  );
}
