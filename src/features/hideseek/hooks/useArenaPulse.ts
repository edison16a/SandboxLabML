'use client';

import { useSyncExternalStore } from 'react';
import { DEFAULT_HIDESEEK_PHYSICS } from '@/engine/hideseek/physics';
import { sandboxHiderCount } from '@/engine/hideseek/sandbox/snapshot';
import { hideSeekSettingsOf } from '@/engine/training/hideseekRunConfig';
import { STRIDE } from '@/render/hideseek/frame/snapshotRead';
import { hideSeekSession } from '../session/HideSeekSession';
import { useHideSeekLab } from '../state/hideSeekStore';

/** What the HUD shows about the arenas on screen, sampled a few times a second. */
export interface ArenaPulse {
  arenas: number;
  /** Match time of the inspected arena, s, and whether it is still in prep. */
  time: number;
  prep: boolean;
  /** Arenas in the seek phase, and how many of their hiders are out of sight right now. */
  seeking: number;
  hidden: number;
  /** Sandbox only (false and zero elsewhere): the match has played out, how many hiders it has and how many are in sight. */
  over: boolean;
  hiders: number;
  hidersSeen: number;
}

const EMPTY: ArenaPulse = { arenas: 0, time: 0, prep: true, seeking: 0, hidden: 0, over: false, hiders: 0, hidersSeen: 0 };
const SAMPLE_MS = 250;

/**
 * The Sandbox is one arena with many hiders, so "hidden now" counts hiders:
 * its frame header holds how many there are and how many are in sight.
 */
function sandboxPulse(buf: Float32Array): ArenaPulse {
  const prep = buf[1] === 1;
  const hiders = sandboxHiderCount(buf);
  const hidersSeen = buf[7] | 0;
  return { arenas: 1, time: buf[0], prep, seeking: prep ? 0 : hiders, hidden: prep ? 0 : hiders - hidersSeen, over: buf[3] === 1, hiders, hidersSeen };
}

/** Reads the latest frame of the feed the viewport shows. */
function readPulse(): ArenaPulse {
  const feed = hideSeekSession().feed();
  const buf = feed?.curr?.buffer;
  if (!feed || !buf || feed.count === 0) return EMPTY;
  const s = useHideSeekLab.getState();
  if (s.mode === 'sandbox') return buf.length >= 8 ? sandboxPulse(buf) : EMPTY;
  const n = Math.min(feed.count, s.gridSize === 1 ? feed.count : s.gridSize);
  let seeking = 0;
  let hidden = 0;
  for (let i = 0; i < n; i++) {
    if (buf[i * STRIDE + 1] === 1) continue;
    seeking++;
    if (buf[i * STRIDE + 2] === 0) hidden++;
  }
  const a = Math.min(feed.count - 1, s.focus ?? 0) * STRIDE;
  return { ...EMPTY, arenas: n, time: buf[a], prep: buf[a + 1] === 1, seeking, hidden };
}

const same = (a: ArenaPulse, b: ArenaPulse) => (Object.keys(a) as Array<keyof ArenaPulse>).every((k) => a[k] === b[k]);

// One sampler feeds every part of the HUD that shows the pulse, so they all
// agree on the frame they read and only one interval runs however many do.
let current = EMPTY;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;

function sample(): void {
  const next = readPulse();
  if (same(next, current)) return;
  current = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!timer) {
    current = readPulse();
    timer = setInterval(sample, SAMPLE_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size || !timer) return;
    clearInterval(timer);
    timer = null;
  };
}

/**
 * Samples the feed the viewport shows four times a second. The HUD does
 * not need 60 updates a second, and reading the latest buffer here keeps
 * React out of the render loop entirely. A paused match re-renders nothing.
 */
export function useArenaPulse(): ArenaPulse {
  return useSyncExternalStore(subscribe, () => current, () => EMPTY);
}

/**
 * Seconds left in the phase on screen: prep time left during prep, then
 * match time left. Every HUD clock counts down with this, so they agree.
 */
export function usePhaseLeft(pulse: ArenaPulse): number {
  const run = useHideSeekLab((s) => s.run);
  const physics = run?.env === 'hideseek' ? hideSeekSettingsOf(run).physics : DEFAULT_HIDESEEK_PHYSICS;
  const end = pulse.prep ? physics.matchSeconds * physics.prepShare : physics.matchSeconds;
  return Math.max(0, end - pulse.time);
}
