'use client';

import { useEffect, useState } from 'react';
import { sandboxCounts } from '@/engine/hideseek/sandbox/snapshot';
import { hideSeekSession } from '../../session/HideSeekSession';

/** What the Sandbox card shows about the match, from the latest frame header. */
export interface SandboxPulse {
  time: number;
  prep: boolean;
  over: boolean;
  hiders: number;
  hidersSeen: number;
}

const EMPTY: SandboxPulse = { time: 0, prep: true, over: false, hiders: 0, hidersSeen: 0 };

/** Samples the Sandbox stream four times a second, so React stays out of the render loop. */
export function useSandboxPulse(): SandboxPulse {
  const [pulse, setPulse] = useState(EMPTY);
  useEffect(() => {
    const id = setInterval(() => {
      const buf = hideSeekSession().streams?.sandbox.curr?.buffer;
      if (!buf || buf.length < 8) return;
      const next = { time: Math.floor(buf[0] * 10) / 10, prep: buf[1] === 1, over: buf[3] === 1, hiders: sandboxCounts(buf).hiders, hidersSeen: buf[7] };
      setPulse((p) => (p.time === next.time && p.prep === next.prep && p.over === next.over && p.hiders === next.hiders && p.hidersSeen === next.hidersSeen ? p : next));
    }, 250);
    return () => clearInterval(id);
  }, []);
  return pulse;
}
