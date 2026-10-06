'use client';

import { useEffect, useState } from 'react';
import { formatBytes } from '@/engine/neat/metrics';
import { browserStorageEstimate } from '@/storage/meter';

/** How much of the browser's storage quota SandboxLab uses, with Trash called out. */
export function StorageMeter({ trashBytes, refreshKey }: { trashBytes: number; refreshKey: number }) {
  const [est, setEst] = useState<{ usage: number; quota: number } | null>(null);
  useEffect(() => {
    void browserStorageEstimate().then(setEst);
  }, [refreshKey]);
  if (!est) return null;
  const share = est.quota ? Math.min(1, est.usage / est.quota) : 0;
  const trashShare = est.quota ? Math.min(share, trashBytes / est.quota) : 0;
  return (
    <div className="flex w-full max-w-sm flex-col gap-1.5">
      <div className="flex justify-between text-[12px] text-muted">
        <span>
          Storage <span className="font-mono text-fg">{formatBytes(est.usage)}</span> of {formatBytes(est.quota)}
        </span>
        {trashBytes > 0 && <span>Trash {formatBytes(trashBytes)}</span>}
      </div>
      <div className="relative h-1.5 overflow-hidden rounded-full bg-surface-3" role="meter" aria-valuenow={Math.round(share * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Storage used">
        <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: `${Math.max(0.5, share * 100)}%` }} />
        <div className="absolute inset-y-0 bg-orange" style={{ left: `${(share - trashShare) * 100}%`, width: `${trashShare * 100}%` }} />
      </div>
    </div>
  );
}
