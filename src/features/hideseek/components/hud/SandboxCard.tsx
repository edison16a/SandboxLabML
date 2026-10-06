'use client';

import { useEffect, useState } from 'react';
import { Dices, Lock, LockOpen, Pause, Play, RotateCcw } from 'lucide-react';
import { HIDESEEK_LAYOUT_IDS, HIDESEEK_LAYOUTS } from '@/engine/hideseek/layouts/presets';
import type { HideSeekLayoutId } from '@/engine/hideseek/layouts/types';
import { Button } from '@/ui/primitives/Button';
import { Segmented } from '@/ui/primitives/Segmented';
import { Slider } from '@/ui/primitives/Slider';
import { boxAt } from '@/render/hideseek/frame/snapshotRead';
import { hideSeekSession } from '../../session/HideSeekSession';
import { useHideSeekLab } from '../../state/hideSeekStore';

const BOX_NAMES = ['Cube 1', 'Cube 2', 'Plank 1', 'Plank 2'];

/** Lock state of the Sandbox crates, read from the feed a few times a second. */
function useLocks(): boolean[] {
  const [locks, setLocks] = useState([false, false, false, false]);
  useEffect(() => {
    const id = setInterval(() => {
      const buf = hideSeekSession().feed()?.curr?.buffer;
      if (!buf) return;
      const next = BOX_NAMES.map((_, b) => buf[boxAt(0, b) + 3] === 1);
      setLocks((prev) => (prev.every((v, i) => v === next[i]) ? prev : next));
    }, 250);
    return () => clearInterval(id);
  }, []);
  return locks;
}

/**
 * Sandbox controls over the viewport: which generation's champion plays
 * each side, the room, play and restart, and a lock switch per crate.
 * Changing a pick rebuilds the match; lesions carry over.
 */
export function SandboxCard() {
  const mode = useHideSeekLab((s) => s.mode);
  const photo = useHideSeekLab((s) => s.photoMode);
  const sandbox = useHideSeekLab((s) => s.sandbox);
  const records = useHideSeekLab((s) => s.records);
  const setSandbox = useHideSeekLab((s) => s.setSandbox);
  const locks = useLocks();
  if (mode !== 'sandbox' || photo || !records.length) return null;
  const control = hideSeekSession().sandbox;
  const first = records[0].generation;
  const last = records[records.length - 1].generation;
  const pick = (patch: Partial<typeof sandbox>) => {
    setSandbox(patch);
    void control?.reload();
  };
  return (
    <div className="flex w-72 flex-col gap-3 rounded-lg border border-white/10 bg-black/60 p-3 text-white backdrop-blur-md">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold tracking-wide text-white/60 uppercase">Sandbox</span>
        <div className="flex gap-1">
          <Button size="icon-sm" variant="secondary" className="border-white/10 bg-white/10 text-white hover:bg-white/20" onClick={() => void control?.setPlaying(!sandbox.playing)} aria-label={sandbox.playing ? 'Pause' : 'Play'}>
            {sandbox.playing ? <Pause /> : <Play />}
          </Button>
          <Button size="icon-sm" variant="secondary" className="border-white/10 bg-white/10 text-white hover:bg-white/20" onClick={() => void control?.restart()} aria-label="Restart the match">
            <RotateCcw />
          </Button>
        </div>
      </div>
      {(['hider', 'seeker'] as const).map((team) => {
        const key = team === 'hider' ? 'hiderGeneration' : 'seekerGeneration';
        return (
          <div key={team} className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[12px]">
              <span className="flex items-center gap-1.5 text-white/75">
                <span className={`size-2 rounded-full ${team === 'hider' ? 'bg-hider' : 'bg-seeker'}`} />
                {team === 'hider' ? 'Hider' : 'Seeker'} from generation
              </span>
              <span className="tabular font-mono">{sandbox[key] + 1}</span>
            </div>
            <Slider label={`${team} generation`} min={first} max={last} value={sandbox[key]} onChange={(v) => setSandbox({ [key]: v })} onCommit={(v) => pick({ [key]: v })} />
          </div>
        );
      })}
      <div className="flex items-center gap-1.5">
        <Segmented<HideSeekLayoutId>
          label="Room"
          size="sm"
          overlay
          className="border-white/10 bg-white/5"
          value={sandbox.layout}
          onChange={(v) => pick({ layout: v })}
          options={HIDESEEK_LAYOUT_IDS.map((id) => ({ value: id, label: HIDESEEK_LAYOUTS[id].name.replace(' room', '') }))}
        />
        <Button size="icon-sm" variant="secondary" className="border-white/10 bg-white/10 text-white hover:bg-white/20" onClick={() => pick({ seed: Math.floor(Math.random() * 1e6) })} aria-label="New spawn positions">
          <Dices />
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        {BOX_NAMES.map((name, b) => (
          <button
            key={name}
            type="button"
            onClick={() => control?.setBoxLocked(b, !locks[b])}
            className={`flex h-7 items-center justify-between rounded-md border px-2 text-[12px] transition-colors ${locks[b] ? 'border-[#ffb547]/60 bg-[#ffb547]/20 text-[#ffd79a]' : 'border-white/10 bg-white/5 text-white/80 hover:bg-white/10'}`}
          >
            {name}
            {locks[b] ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5 text-white/50" />}
          </button>
        ))}
      </div>
    </div>
  );
}
