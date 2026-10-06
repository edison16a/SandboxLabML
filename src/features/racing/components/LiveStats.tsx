'use client';

import { useEffect, useState } from 'react';
import { RACING_SNAPSHOT } from '@/engine/racing/env';
import type { SnapshotStream } from '@/workers/client/snapshotStream';
import { useRacingLab } from '../state/labStore';

const STRIDE = RACING_SNAPSHOT.stride;

interface Live {
  alive: number;
  total: number;
  leaderDistance: number;
  leaderSpeed: number;
}

/** Reads the population stream four times a second for the HUD chips. */
function useLive(stream: SnapshotStream | null): Live {
  const [live, setLive] = useState<Live>({ alive: 0, total: 0, leaderDistance: 0, leaderSpeed: 0 });
  useEffect(() => {
    const id = setInterval(() => {
      const buf = stream?.curr?.buffer;
      if (!buf || !stream) return;
      let alive = 0;
      let best = -Infinity;
      let speed = 0;
      for (let i = 0; i < stream.count; i++) {
        const driving = buf[i * STRIDE + 6] === 0;
        if (driving) alive++;
        // Prefer cars still driving, matching how the camera picks the leader.
        const score = buf[i * STRIDE + 7] + (driving ? 1e6 : 0);
        if (score > best) {
          best = score;
          speed = buf[i * STRIDE + 3];
        }
      }
      best = best >= 1e6 ? best - 1e6 : best;
      setLive({ alive, total: stream.count, leaderDistance: Math.max(0, best), leaderSpeed: speed });
    }, 250);
    return () => clearInterval(id);
  }, [stream]);
  return live;
}

function Chip({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col rounded-md border border-white/10 bg-black/45 px-2.5 py-1.5 leading-tight backdrop-blur-sm">
      <span className="text-[10px] font-medium tracking-wide text-white/60 uppercase">{label}</span>
      <span className="tabular font-mono text-[14px] font-semibold text-white">{value}</span>
    </div>
  );
}

/** Generation, cars still driving, leader distance and best lap, top left of the viewport. */
export function LiveStats({ stream }: { stream: SnapshotStream | null }) {
  const live = useLive(stream);
  const gen = useRacingLab((s) => s.liveGeneration);
  const records = useRacingLab((s) => s.records);
  const status = useRacingLab((s) => s.status);
  const speed = useRacingLab((s) => s.speed);
  const bestLap = records.reduce((b, r) => (r.champion.bestLapTime > 0 && (b === 0 || r.champion.bestLapTime < b) ? r.champion.bestLapTime : b), 0);
  const bestDistance = records.reduce((b, r) => Math.max(b, r.champion.distance), 0);
  const watching = status === 'running' && (speed === '1x' || speed === '2x' || speed === '4x');
  return (
    <div className="pointer-events-none flex flex-wrap gap-1.5">
      <Chip label="Generation" value={gen + 1} />
      {watching && live.total > 0 && <Chip label="Driving" value={`${live.alive} / ${live.total}`} />}
      {watching && <Chip label="Leader" value={`${Math.round(live.leaderDistance)} m`} />}
      {watching && <Chip label="Speed" value={`${Math.round(live.leaderSpeed * 3.6)} km/h`} />}
      {!watching && <Chip label="Best distance" value={`${Math.round(bestDistance)} m`} />}
      <Chip label="Best lap" value={bestLap > 0 ? `${bestLap.toFixed(2)} s` : 'none yet'} />
    </div>
  );
}
