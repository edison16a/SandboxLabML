'use client';

import { Camera, ScanEye, Sparkles, SquareSplitHorizontal } from 'lucide-react';
import { Button } from '@/ui/primitives/Button';
import { Segmented } from '@/ui/primitives/Segmented';
import { Select } from '@/ui/primitives/Select';
import { Tooltip } from '@/ui/primitives/Tooltip';
import { allowedGridSizes } from '../../hooks/useHideSeekShortcuts';
import { useSettings } from '@/features/settings/settingsStore';
import { gridCapped, useHideSeekLab } from '../../state/hideSeekStore';
import type { GridSize, HsCamera } from '../../state/types';

export const glass = 'border-white/10 bg-black/50 text-white backdrop-blur-sm hover:bg-black/65';
const on = 'border-accent/60 bg-accent/25 text-white hover:bg-accent/35';

/** Grid size, camera, overlays and effects, top right of the viewport. Quality lives in Settings. */
export function ViewControls() {
  const mode = useHideSeekLab((s) => s.mode);
  const grid = useHideSeekLab((s) => s.gridSize);
  const camera = useHideSeekLab((s) => s.camera);
  const inputs = useHideSeekLab((s) => s.inputsOverlay);
  const pov = useHideSeekLab((s) => s.pov);
  const effects = useHideSeekLab((s) => s.effects);
  const weak = useSettings(gridCapped);
  const set = useHideSeekLab((s) => s.set);
  const sizes = allowedGridSizes(weak);
  return (
    <div className="flex flex-wrap items-center justify-end gap-1.5">
      {mode === 'train' && (
        <Tooltip content={weak ? 'Arenas on screen. This GPU shows up to 25 until you pick a quality in Settings.' : 'Arenas on screen'} shortcut="G">
          <span>
            <Segmented<`${GridSize}`>
              label="Arenas on screen"
              size="sm"
              overlay
              className="border-white/10 bg-black/50 backdrop-blur-sm"
              value={`${grid}`}
              onChange={(v) => set({ gridSize: Number(v) as GridSize, focus: null })}
              options={sizes.map((g) => ({ value: `${g}` as const, label: `${g}`, title: g === 1 ? 'One arena in full detail' : `${g} arenas` }))}
            />
          </span>
        </Tooltip>
      )}
      <Select<HsCamera>
        label="Camera"
        value={camera}
        onChange={(v) => set({ camera: v })}
        className={`h-7 w-32 ${glass}`}
        options={[
          { value: 'orbit', label: 'Orbit', hint: 'Drag to turn, scroll to zoom' },
          { value: 'top', label: 'Top down' },
          { value: 'seeker', label: 'Seeker view', hint: 'First person, focused arena' },
          { value: 'hider', label: 'Hider view', hint: 'First person, focused arena' },
        ]}
      />
      <Tooltip content="Show what the agents sense" shortcut="I">
        <Button data-tour="inputs" size="sm" variant="secondary" className={inputs ? on : glass} onClick={() => set({ inputsOverlay: !inputs })} aria-pressed={inputs}>
          <ScanEye />
          Inputs
        </Button>
      </Tooltip>
      <Tooltip content="Picture in picture views from both agents of the focused arena">
        <Button size="icon-sm" variant="secondary" className={pov ? on : glass} onClick={() => set({ pov: !pov })} aria-pressed={pov} aria-label="Agent views">
          <SquareSplitHorizontal />
        </Button>
      </Tooltip>
      <Tooltip content="Ambient occlusion, bloom and tone mapping on the focused arena, at High quality">
        <Button size="icon-sm" variant="secondary" className={effects ? on : glass} onClick={() => set({ effects: !effects })} aria-pressed={effects} aria-label="Post-processing">
          <Sparkles />
        </Button>
      </Tooltip>
      <Tooltip content="Photo mode: hide the controls, add depth of field and save a PNG">
        <Button size="icon-sm" variant="secondary" className={glass} onClick={() => set({ photoMode: true, focus: useHideSeekLab.getState().focus ?? 0 })} aria-label="Photo mode">
          <Camera />
        </Button>
      </Tooltip>
    </div>
  );
}
