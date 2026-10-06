'use client';

import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { HIDESEEK_LAYOUT_IDS } from '@/engine/hideseek/layouts/presets';
import { useDisposable } from '@/render/shared/useDisposable';
import { useHsScene } from '../frame/sceneContext';
import { wallsOfLayout } from '../layout/arenaWalls';
import { arenaOrigin } from '../layout/gridLattice';
import { floorAoMaterial } from '../room/floorAoMaterial';
import { floorAoGeometry } from '../room/roomGeometry';
import { commit, GRID_LAYER, makeScratch, MAX_ARENAS, placeInstance } from './scratch';

/**
 * The soft shade along the foot of every wall, for the grid arenas: the
 * same baked bands as the showcase room, one instanced draw call per
 * layout, with an instance for every arena of that layout. The grid has no
 * shadow maps, and this is what keeps its walls from looking pasted on.
 */
export function GridWallShade() {
  const { frame } = useHsScene();
  const meshes = useRef<Array<THREE.InstancedMesh | null>>([]);
  const geometries = useDisposable(() => {
    const list = HIDESEEK_LAYOUT_IDS.map((_, i) => floorAoGeometry(wallsOfLayout(i)));
    return { list, dispose: () => list.forEach((g) => g.dispose()) };
  }, []);
  const material = useDisposable(() => floorAoMaterial(0.42), []);
  const t = useMemo(() => ({ ...makeScratch(), counts: new Int32Array(HIDESEEK_LAYOUT_IDS.length) }), []);

  useFrame(() => {
    if (t.version === frame.version) return;
    t.version = frame.version;
    t.counts.fill(0);
    for (let k = 0; frame.count > 1 && k < frame.count; k++) {
      const layout = frame.layouts[k] ?? 0;
      const m = meshes.current[layout];
      if (!m) continue;
      arenaOrigin(k, frame.lattice, t.o);
      const hide = k === frame.focusSlot ? 0 : 1;
      placeInstance(m, t.counts[layout]++, t, t.o.x, 0, t.o.z, 0, hide, 1, hide);
    }
    meshes.current.forEach((m, i) => m && commit(m, t.counts[i]));
  });

  return (
    <group>
      {geometries.list.map((g, i) => (
        <instancedMesh key={i} layers={GRID_LAYER} ref={(el) => void (meshes.current[i] = el)} args={[g, material, MAX_ARENAS]} frustumCulled={false} renderOrder={1} raycast={() => null} />
      ))}
    </group>
  );
}
