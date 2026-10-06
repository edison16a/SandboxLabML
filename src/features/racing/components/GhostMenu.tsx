'use client';

import { Ghost } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Field, TextInput } from '@/ui/primitives/Field';
import { Popover } from '@/ui/primitives/Popover';
import { Segmented } from '@/ui/primitives/Segmented';
import { Switch } from '@/ui/primitives/Switch';
import { racingSession } from '../session/RacingSession';
import type { GhostSelection } from '../session/ghostSelection';
import { useRacingLab } from '../state/labStore';

type Mode = GhostSelection['mode'];

/** Which past champions ride along as ghosts, plus trail and crash ring toggles. */
export function GhostMenu() {
  const sel = useRacingLab((s) => s.ghostSelection);
  const trails = useRacingLab((s) => s.ghostTrails);
  const rings = useRacingLab((s) => s.ghostCrashRings);
  const brakes = useRacingLab((s) => s.brakeMap);
  const gens = useRacingLab((s) => s.ghostGenerations);
  const set = useRacingLab((s) => s.set);
  const apply = (next: GhostSelection) => {
    set({ ghostSelection: next });
    void racingSession().refreshGhosts();
  };
  const changeMode = (mode: Mode) => {
    if (mode === 'auto') apply({ mode });
    else if (mode === 'every') apply({ mode, n: 5 });
    else if (mode === 'range') apply({ mode, from: 0, to: 20 });
    else apply({ mode, generations: gens });
  };
  return (
    <Popover
      align="end"
      trigger={
        <Button size="sm" variant="secondary" className="border-white/10 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60">
          <Ghost />
          Ghosts {gens.length > 0 && <span className="text-white/60">{gens.length}</span>}
        </Button>
      }
    >
      <div className="flex flex-col gap-3">
        <Field label="Which generations">
          <Segmented<Mode>
            label="Ghost selection"
            size="sm"
            value={sel.mode}
            onChange={changeMode}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'every', label: 'Every Nth' },
              { value: 'range', label: 'Range' },
              { value: 'pick', label: 'Pick' },
            ]}
          />
        </Field>
        {sel.mode === 'every' && (
          <Field label="Every">
            <TextInput type="number" min={1} value={sel.n} onChange={(e) => apply({ mode: 'every', n: Math.max(1, Number(e.target.value) || 1) })} />
          </Field>
        )}
        {sel.mode === 'range' && (
          <div className="grid grid-cols-2 gap-2">
            <Field label="From gen">
              <TextInput type="number" min={1} value={sel.from + 1} onChange={(e) => apply({ ...sel, from: Math.max(0, Number(e.target.value) - 1) })} />
            </Field>
            <Field label="To gen">
              <TextInput type="number" min={1} value={sel.to + 1} onChange={(e) => apply({ ...sel, to: Math.max(0, Number(e.target.value) - 1) })} />
            </Field>
          </div>
        )}
        {sel.mode === 'pick' && (
          <Field label="Generations" hint="Comma separated, e.g. 1, 5, 20">
            <TextInput
              defaultValue={sel.generations.map((g) => g + 1).join(', ')}
              onBlur={(e) => apply({ mode: 'pick', generations: e.target.value.split(',').map((x) => Number(x.trim()) - 1).filter((x) => x >= 0) })}
            />
          </Field>
        )}
        <p className="text-[12px] text-muted">
          Showing {gens.length ? gens.map((g) => g + 1).join(', ') : 'none yet'}. Ghosts are re-simulated from stored champions, so they cost almost no storage.
        </p>
        <label className="flex items-center justify-between text-[13px]">
          Fading trails
          <Switch label="Fading trails" checked={trails} onChange={(v) => set({ ghostTrails: v })} />
        </label>
        <label className="flex items-center justify-between text-[13px]">
          <span className="flex flex-col">
            Brake map
            <span className="text-[11px] text-muted">Where each champion braked, colored by generation</span>
          </span>
          <Switch label="Brake map" checked={brakes} onChange={(v) => set({ brakeMap: v })} />
        </label>
        <label className="flex items-center justify-between text-[13px]">
          Crash rings
          <Switch label="Crash rings" checked={rings} onChange={(v) => set({ ghostCrashRings: v })} />
        </label>
      </div>
    </Popover>
  );
}
