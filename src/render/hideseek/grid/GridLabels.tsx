'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { useMemo, useRef, useState } from 'react';
import { useHsScene } from '../frame/sceneContext';
import { arenaHiderSeen, arenaInPrep } from '../frame/snapshotRead';
import { arenaOrigin, ARENA_SPAN } from '../layout/gridLattice';

/** Above this many arenas, labels would be unreadable clutter, so none are drawn. */
const MAX_LABELS = 25;

type Phase = 'prep' | 'hidden' | 'seen';

const PHASE_TEXT: Record<Phase, string> = { prep: 'Prep', hidden: 'Hidden', seen: 'Seen' };
const PHASE_CLASS: Record<Phase, string> = { prep: 'bg-white/10 text-white/70', hidden: 'bg-hider/25 text-[#b9d6ff]', seen: 'bg-seeker/30 text-[#ffd0d5]' };

/**
 * DOM labels over each arena when the grid shows 25 or fewer: the arena
 * number and whether its hider is hidden right now. Text is written to the
 * DOM directly, and only when it changes, so React stays out of the frame.
 */
export function GridLabels() {
  const { frame } = useHsScene();
  const [shown, setShown] = useState(0);
  const anchors = useRef<Array<THREE.Group | null>>([]);
  const names = useRef<Array<HTMLSpanElement | null>>([]);
  const chips = useRef<Array<HTMLSpanElement | null>>([]);
  const cards = useRef<Array<HTMLDivElement | null>>([]);
  const state = useMemo(() => ({ o: { x: 0, z: 0 }, phases: [] as Array<Phase | null>, first: -1 }), []);

  useFrame(() => {
    const n = frame.count > 1 && frame.count <= MAX_LABELS ? frame.count : 0;
    if (n !== shown) {
      setShown(n);
      state.phases = [];
    }
    const curr = frame.curr;
    if (!curr) return;
    const relabel = state.first !== frame.first;
    state.first = frame.first;
    for (let k = 0; k < n; k++) {
      const anchor = anchors.current[k];
      if (!anchor) continue;
      arenaOrigin(k, frame.lattice, state.o);
      anchor.position.set(state.o.x, 0, state.o.z - ARENA_SPAN / 2 - 0.9);
      // The showcase labels the focused arena itself, so its DOM label would only sit in the way.
      const card = cards.current[k];
      if (card) card.style.display = k === frame.focusSlot ? 'none' : 'flex';
      const arena = frame.first + k;
      const phase: Phase = arenaInPrep(curr, arena) ? 'prep' : arenaHiderSeen(curr, arena) ? 'seen' : 'hidden';
      const chip = chips.current[k];
      if (chip && state.phases[k] !== phase) {
        state.phases[k] = phase;
        chip.textContent = PHASE_TEXT[phase];
        chip.className = `rounded px-1 py-px text-[10px] font-semibold ${PHASE_CLASS[phase]}`;
      }
      const name = names.current[k];
      if (name && (relabel || !name.textContent)) name.textContent = `Arena ${frame.first + k + 1}`;
    }
  });

  return (
    <group>
      {Array.from({ length: shown }, (_, k) => (
        <group key={k} ref={(el) => void (anchors.current[k] = el)}>
          <Html center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <div ref={(el) => void (cards.current[k] = el)} className="flex items-center gap-1.5 rounded-md border border-white/10 bg-black/55 px-1.5 py-0.5 whitespace-nowrap text-white backdrop-blur-sm">
              <span ref={(el) => void (names.current[k] = el)} className="font-mono text-[11px] text-white/85" />
              <span ref={(el) => void (chips.current[k] = el)} />
            </div>
          </Html>
        </group>
      ))}
    </group>
  );
}
