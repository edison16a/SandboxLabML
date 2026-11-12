'use client';

import { Crosshair, Gauge, ScanEye } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Segmented } from '@/ui/primitives/Segmented';
import { Select } from '@/ui/primitives/Select';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { useLab, useLabContext, useLabSet } from '../LabContext';
import { viewportHeld, type ViewMode } from '../state/labState';

/** The see through dark style every control over a viewport uses. */
export const glass = 'border-white/10 bg-black/45 text-white backdrop-blur-sm hover:bg-black/60';

const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Shows who the camera follows when it is not the leader, and goes back to the leader on click. */
export function FocusChip() {
  const { agentNoun } = useLabContext();
  const focus = useLab((s) => s.focus);
  const set = useLabSet();
  if (focus.kind === 'champion') return null;
  const label = focus.kind === 'agent' ? `${capital(agentNoun)} ${focus.index + 1}` : `Gen ${focus.generation + 1} ghost`;
  return (
    <Button size="sm" variant="secondary" className={glass} onClick={() => set({ focus: { kind: 'champion' } })}>
      <Crosshair />
      {label}
      <span className="text-white/50">follow leader</span>
    </Button>
  );
}

/** Says why the picture stopped moving while Max trains, and how to get it back. */
export function HeldNote() {
  const held = useLab(viewportHeld);
  if (!held) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-14 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-md border border-white/10 bg-black/60 px-3 py-2 text-[12px] text-white/85 backdrop-blur-sm">
        <Gauge className="size-3.5 text-accent" />
        Paused while Max trains. Pick Turbo to watch.
      </div>
    </div>
  );
}

/** Population, the ghosts of past champions, or both. */
export function ViewSwitch() {
  const view = useLab((s) => s.view);
  const set = useLabSet();
  return (
    <Segmented<ViewMode>
      data-tour="view"
      label="What to show"
      size="sm"
      value={view}
      onChange={(v) => set({ view: v })}
      className="border-white/10 bg-black/45 backdrop-blur-sm"
      overlay
      options={[
        { value: 'population', label: 'Population', title: 'The live generation' },
        { value: 'overlay', label: 'Overlay', title: 'Ghosts of past champions' },
        { value: 'both', label: 'Both' },
      ]}
    />
  );
}

/** Turns the inputs overlay on and off. */
export function InputsToggle() {
  const { agentNoun } = useLabContext();
  const inputs = useLab((s) => s.inputsOverlay);
  const set = useLabSet();
  return (
    <Tooltip content={`Show what the ${agentNoun} senses`} shortcut="I">
      <Button data-tour="inputs" size="sm" variant="secondary" className={inputs ? 'border-accent/60 bg-accent/25 text-white' : glass} onClick={() => set({ inputsOverlay: !inputs })} aria-pressed={inputs}>
        <ScanEye />
        Inputs
      </Button>
    </Tooltip>
  );
}

/** Picks the lab's camera. `options` are its cameras in the order C cycles them. */
export function CameraSelect({ options }: { options: ReadonlyArray<{ value: string; label: string }> }) {
  const camera = useLab((s) => s.camera);
  const set = useLabSet();
  return (
    <Tooltip content="Camera" shortcut="C">
      <span>
        <Select<string> label="Camera" value={camera} onChange={(v) => set({ camera: v })} className={`h-7 w-28 ${glass}`} options={[...options]} />
      </span>
    </Tooltip>
  );
}
