'use client';

import { useCallback, useMemo } from 'react';
import { useHideSeekLab } from '@/features/hideseek/state/hideSeekStore';
import { useHsScene } from '../frame/sceneContext';
import { ArenaBalance } from './arenaBalance';
import { GridAgents } from './GridAgents';
import { GridBorders } from './GridBorders';
import { GridBoxes } from './GridBoxes';
import { GridCones } from './GridCones';
import { GridLabels } from './GridLabels';
import { GridShadows } from './GridShadows';
import { GridWalls } from './GridWalls';

/**
 * The arena grid: every arena drawn from shared instanced meshes, so the
 * draw call count stays flat from 2 to 50 arenas. No shadow maps and plain
 * geometry; the showcase takes over whichever arena is focused.
 */
export function GridScene() {
  const { frame } = useHsScene();
  const balance = useMemo(() => new ArenaBalance(), []);
  const pick = useCallback(
    (slot: number) => {
      const s = useHideSeekLab.getState();
      if (s.mode !== 'train' || frame.count <= 1 || slot === frame.focusSlot) return;
      s.set({ focus: frame.first + slot });
    },
    [frame],
  );
  return (
    <group>
      <GridWalls onPick={pick} />
      <GridBoxes onPick={pick} />
      <GridAgents onPick={pick} />
      <GridShadows />
      <GridCones />
      <GridBorders balance={balance} />
      <GridLabels />
    </group>
  );
}
