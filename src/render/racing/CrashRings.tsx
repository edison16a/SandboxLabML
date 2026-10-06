'use client';

import * as THREE from 'three';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { useRacingLab } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import { ghostColor } from './palette';

/**
 * A ring where each ghost generation's champion left the road, plus the
 * hover label ("Gen 12, crashed at 212 m"). Rings come from the stored
 * champion records, so they show up before the ghost even gets there.
 */
export function CrashRings() {
  const records = useRacingLab((s) => s.records);
  const gens = useRacingLab((s) => s.ghostGenerations);
  const show = useRacingLab((s) => s.ghostCrashRings && s.view !== 'population');
  const hovered = useRacingLab((s) => s.hoveredGhost);
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => new THREE.TorusGeometry(1.6, 0.12, 6, 32).rotateX(Math.PI / 2), []);
  const crashes = useMemo(() => {
    const byGen = new Map(records.map((r) => [r.generation, r]));
    return gens
      .map((g, i) => ({ g, t: gens.length > 1 ? i / (gens.length - 1) : 1, r: byGen.get(g) }))
      .filter((c) => c.r?.champion.crashed);
  }, [records, gens]);

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    const c = new THREE.Color();
    crashes.forEach(({ r, t }, i) => {
      mat.makeTranslation(r!.champion.crashX, 0.15, -r!.champion.crashY);
      m.setMatrixAt(i, mat);
      m.setColorAt(i, ghostColor(t, c));
    });
    m.count = crashes.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [crashes]);

  const hoverRecord = hovered !== null ? records.find((r) => r.generation === hovered) : undefined;

  return (
    <group visible={show}>
      <instancedMesh ref={ref} args={[geometry, undefined, 64]} frustumCulled={false}>
        <meshBasicMaterial transparent opacity={0.8} toneMapped={false} />
      </instancedMesh>
      {show && hoverRecord && (
        <Html position={[hoverRecord.champion.crashX, 3, -hoverRecord.champion.crashY]} center style={{ pointerEvents: 'none' }}>
          <div className="rounded-md border border-border-strong bg-surface-2/95 px-2 py-1 text-[12px] whitespace-nowrap text-fg shadow-lg">
            Gen {hoverRecord.generation + 1},{' '}
            {hoverRecord.champion.crashed
              ? `crashed at ${Math.round(hoverRecord.champion.distance)} m`
              : `${Math.round(hoverRecord.champion.distance)} m, ${hoverRecord.champion.laps} laps`}
          </div>
        </Html>
      )}
    </group>
  );
}
