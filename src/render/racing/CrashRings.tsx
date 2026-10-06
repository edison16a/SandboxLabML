'use client';

import * as THREE from 'three';
import { useLayoutEffect, useMemo, useRef } from 'react';
import { Html } from '@react-three/drei';
import { placedTelemetry, useRacingLab } from '@/features/racing/state/labStore';
import { useDisposable } from '@/render/shared/useDisposable';
import { ghostColor } from './palette';

interface Crash {
  generation: number;
  t: number;
  x: number;
  y: number;
  distance: number;
}

/**
 * Where each ghost generation's champion left the road. In training the
 * points come from the stored records, so rings show up before the ghost
 * even gets there. The Sandbox races on other tracks, where those points
 * mean nothing, so it takes them from its own headless replay instead.
 */
function useCrashes(): Crash[] {
  const records = useRacingLab((s) => s.records);
  const gens = useRacingLab((s) => s.ghostGenerations);
  const telemetry = useRacingLab(placedTelemetry);
  const sandbox = useRacingLab((s) => s.mode === 'sandbox');
  return useMemo(() => {
    if (sandbox) {
      const n = telemetry.length;
      return telemetry.flatMap((tm, i) => (tm.crash ? [{ generation: tm.generation, t: n > 1 ? i / (n - 1) : 1, x: tm.crash.x, y: tm.crash.y, distance: tm.crash.driven }] : []));
    }
    const byGen = new Map(records.map((r) => [r.generation, r]));
    return gens.flatMap((g, i) => {
      const c = byGen.get(g)?.champion;
      return c?.crashed ? [{ generation: g, t: gens.length > 1 ? i / (gens.length - 1) : 1, x: c.crashX, y: c.crashY, distance: c.distance }] : [];
    });
  }, [sandbox, telemetry, records, gens]);
}

/** A ring at each crash point, plus the hover label ("Gen 12, crashed at 212 m"). */
export function CrashRings() {
  const records = useRacingLab((s) => s.records);
  const sandbox = useRacingLab((s) => s.mode === 'sandbox');
  const show = useRacingLab((s) => s.ghostCrashRings && s.view !== 'population');
  const hovered = useRacingLab((s) => s.hoveredGhost);
  const ref = useRef<THREE.InstancedMesh>(null);
  const geometry = useDisposable(() => new THREE.TorusGeometry(1.6, 0.12, 6, 32).rotateX(Math.PI / 2), []);
  const crashes = useCrashes();

  useLayoutEffect(() => {
    const m = ref.current;
    if (!m) return;
    const mat = new THREE.Matrix4();
    const c = new THREE.Color();
    crashes.forEach(({ x, y, t }, i) => {
      mat.makeTranslation(x, 0.15, -y);
      m.setMatrixAt(i, mat);
      m.setColorAt(i, ghostColor(t, c));
    });
    m.count = crashes.length;
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [crashes]);

  const hoverRecord = !sandbox && hovered !== null ? records.find((r) => r.generation === hovered) : undefined;
  const hoverCrash = sandbox && hovered !== null ? crashes.find((c) => c.generation === hovered) : undefined;

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
      {show && hoverCrash && (
        <Html position={[hoverCrash.x, 3, -hoverCrash.y]} center style={{ pointerEvents: 'none' }}>
          <div className="rounded-md border border-border-strong bg-surface-2/95 px-2 py-1 text-[12px] whitespace-nowrap text-fg shadow-lg">
            Gen {hoverCrash.generation + 1}, crashed at {Math.round(hoverCrash.distance)} m
          </div>
        </Html>
      )}
    </group>
  );
}
