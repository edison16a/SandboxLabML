'use client';

import { RotateCcw, ScanEye } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useMemo, useState } from 'react';
import { NAV_LEVELS } from '@/engine/navigation/course/levels';
import { useLabQuality } from '@/features/settings/useLabQuality';
import { Button } from '@/ui/primitives/Button';
import { Segmented } from '@/ui/primitives/Segmented';
import { useCameraKey } from '../camera/useCameraKey';
import { NavigationCanvas } from '../NavigationCanvas';
import { NAV_CAMERAS, nextCamera, type NavCamera } from '../types';
import { PreviewSim } from './previewSim';

const CAMERA_LABELS: Record<NavCamera, string> = { follow: 'Follow', overview: 'Overview', top: 'Top', free: 'Free' };

function numberParam(v: string | null, fallback: number): number {
  const n = Number(v);
  return v !== null && Number.isFinite(n) ? n : fallback;
}

/**
 * A stand alone view of the Navigation world for judging its look before
 * the lab exists: a crowd of scripted navigators runs one level on the
 * main thread, drawn by the real viewport. Address options: level, seed,
 * agents, course (a named course), camera, sensors=0, t (seconds to skip
 * ahead), until (seconds at which to stop), pause=1 and quality.
 */
export function NavigationPreview() {
  const params = useSearchParams();
  const tier = useLabQuality(params.get('quality'));
  const [level, setLevel] = useState(() => Math.max(0, Math.min(6, numberParam(params.get('level'), 3))));
  const [camera, setCamera] = useState<NavCamera>(() => (NAV_CAMERAS as readonly string[]).includes(params.get('camera') ?? '') ? (params.get('camera') as NavCamera) : 'follow');
  const [sensors, setSensors] = useState(params.get('sensors') !== '0');
  const [round, setRound] = useState(0);
  const sim = useMemo(() => {
    const s = new PreviewSim({ level, seed: numberParam(params.get('seed'), 7) + round * 101, agents: numberParam(params.get('agents'), 80), courseId: params.get('course') ?? undefined });
    const skip = numberParam(params.get('t'), 0);
    if (skip > 0) s.skip(skip);
    s.paused = params.get('pause') === '1';
    s.until = numberParam(params.get('until'), Infinity);
    return s;
  }, [level, round, params]);
  const getFeed = useCallback(() => sim, [sim]);
  const onFrame = useCallback((dt: number) => sim.advance(dt), [sim]);

  useCameraKey(useCallback(() => setCamera((c) => nextCamera(c)), []));

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-bg">
      <NavigationCanvas getFeed={getFeed} tier={tier} camera={camera} sensors={sensors} live onFrame={onFrame} />
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 p-3">
        <div className="pointer-events-auto rounded-lg border border-white/10 bg-black/45 p-1 backdrop-blur-md">
          <Segmented
            overlay
            size="sm"
            label="Level"
            value={String(level)}
            onChange={(v) => setLevel(Number(v))}
            options={NAV_LEVELS.map((l) => ({ value: String(l.level), label: String(l.level), title: l.name }))}
          />
        </div>
        <div className="pointer-events-auto rounded-lg border border-white/10 bg-black/45 px-3 py-1.5 text-[12px] font-medium text-white/85 backdrop-blur-md">{NAV_LEVELS[level].name}</div>
        <div className="flex-1" />
        <div className="pointer-events-auto flex items-center gap-1 rounded-lg border border-white/10 bg-black/45 p-1 backdrop-blur-md">
          <Segmented overlay size="sm" label="Camera" value={camera} onChange={setCamera} options={NAV_CAMERAS.map((c) => ({ value: c, label: CAMERA_LABELS[c] }))} />
          <Button size="sm" variant="ghost" className={sensors ? 'text-white' : 'text-white/60'} onClick={() => setSensors((v) => !v)} aria-pressed={sensors}>
            <ScanEye />
            Inputs
          </Button>
          <Button size="icon-sm" variant="ghost" className="text-white/70" onClick={() => setRound((r) => r + 1)} aria-label="New course">
            <RotateCcw />
          </Button>
        </div>
      </div>
    </div>
  );
}
