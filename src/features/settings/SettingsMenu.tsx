'use client';

import { Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { Popover } from '@/ui/primitives/Popover';
import { Segmented } from '@/ui/primitives/Segmented';
import { resolvedQuality, useSettings, type FrameRate, type Quality, type SettingsState } from './settingsStore';
import { ensureGpuProbed } from './useLabQuality';

const NAMES = { low: 'Low', medium: 'Medium', high: 'High', ultra: 'Ultra' } as const;

/** Says where the quality on screen came from when nobody picked it here. */
function qualityHint(s: SettingsState): string {
  if (s.pinned) return `The page address sets ${NAMES[s.pinned]} until you pick one here.`;
  if (s.quality === null && s.weakGpu) return 'Medium suits this GPU. Training results never change.';
  return 'Shadows, effects and sharpness. Training results never change.';
}

/** One setting: the name and its control on a line, a short hint under them. */
function Row({ label, hint, children }: { label: string; hint: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] font-medium text-fg">{label}</span>
        {children}
      </div>
      <p className="text-[12px] leading-snug text-muted">{hint}</p>
    </div>
  );
}

/** Frame rate and quality for both labs, behind the gear at the top right of every page. */
export function SettingsMenu() {
  const frameRate = useSettings((s) => s.frameRate);
  const quality = useSettings(resolvedQuality);
  const hint = useSettings(qualityHint);
  const set = useSettings.getState();
  return (
    <Popover
      align="end"
      label="Settings"
      // Opened outside a lab, the GPU may not be probed yet, and the default quality depends on it.
      onOpenChange={(open) => open && ensureGpuProbed()}
      className="w-80 p-0"
      trigger={
        <button
          type="button"
          aria-label="Settings"
          className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-muted transition-colors hover:border-border-strong hover:bg-surface-2 hover:text-fg data-[state=open]:border-border-strong data-[state=open]:bg-surface-2 data-[state=open]:text-fg [&_svg]:size-4"
        >
          <Settings />
        </button>
      }
    >
      <h2 className="border-b border-border px-3 py-2.5 text-[13px] font-semibold">Settings</h2>
      <Row label="Frame rate" hint="30 saves battery. Max matches your display.">
        <Segmented<FrameRate>
          label="Frame rate"
          value={frameRate}
          onChange={set.setFrameRate}
          options={[
            { value: '30', label: '30' },
            { value: '60', label: '60' },
            { value: 'max', label: 'Max' },
          ]}
        />
      </Row>
      <div className="mx-3 border-t border-border" />
      <Row label="Quality" hint={hint}>
        <Segmented<Quality>
          label="Quality"
          value={quality === 'ultra' ? 'high' : quality}
          onChange={set.setQuality}
          options={[
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
        />
      </Row>
    </Popover>
  );
}
