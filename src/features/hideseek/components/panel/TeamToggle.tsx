'use client';

import { Segmented } from '@/ui/primitives/Segmented';
import type { AgentSlot } from '../../state/types';

/** Hider or seeker, in team colors. Used by the network, inputs and model tabs. */
export function TeamToggle({ value, onChange }: { value: AgentSlot; onChange: (v: AgentSlot) => void }) {
  return (
    <Segmented<'0' | '1'>
      label="Team"
      size="sm"
      value={`${value}` as '0' | '1'}
      onChange={(v) => onChange(Number(v) as AgentSlot)}
      options={[
        {
          value: '0',
          label: (
            <>
              <span className="size-2 rounded-full bg-hider" />
              Hider
            </>
          ),
        },
        {
          value: '1',
          label: (
            <>
              <span className="size-2 rounded-full bg-seeker" />
              Seeker
            </>
          ),
        },
      ]}
    />
  );
}
