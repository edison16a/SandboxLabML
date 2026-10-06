'use client';


import { useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import type { TrackSpec, Vec2 } from '@/engine/racing/track/types';
import { useRacingLab } from '@/features/racing/state/labStore';
import { isTyping } from '@/ui/typing';

interface Props {
  spec: TrackSpec;
  onChange: (spec: TrackSpec) => void;
}

/** Index after which a new point at (x, y) belongs: the closest segment between consecutive points. */
function insertIndex(points: Vec2[], x: number, y: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < points.length; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % points.length];
    const dx = bx - ax;
    const dy = by - ay;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
    const d = (ax + dx * t - x) ** 2 + (ay + dy * t - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  return best + 1;
}

/**
 * Drag handles on the track's control points. Pointer rays hit an invisible
 * ground plane; double click adds a point on the nearest segment and Delete
 * removes the selected one. Updates are throttled to one every 30 ms so the
 * mesh rebuild never falls behind the pointer.
 */
export function TrackEditor({ spec, onChange }: Props) {
  const selected = useRacingLab((s) => s.selectedHandle);
  const set = useRacingLab((s) => s.set);
  const controls = useThree((s) => s.controls) as { enabled: boolean } | null;
  const [drag, setDrag] = useState<number | null>(null);
  const pending = useRef<TrackSpec | null>(null);
  const last = useRef(0);

  const push = (next: TrackSpec, force = false) => {
    const now = performance.now();
    pending.current = next;
    if (force || now - last.current > 30) {
      last.current = now;
      onChange(next);
      pending.current = null;
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Backspace in a text field, such as the track name, edits the text and leaves the track alone.
      if (isTyping(e.target)) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null && spec.points.length > 4) {
        const points = spec.points.filter((_, i) => i !== selected);
        set({ selectedHandle: null });
        onChange({ ...spec, points });
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, spec, onChange, set]);

  const endDrag = () => {
    if (pending.current) onChange(pending.current);
    pending.current = null;
    setDrag(null);
    if (controls) controls.enabled = true;
  };

  return (
    <group>
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.05, 0]}
        visible={false}
        onPointerMove={(e) => {
          if (drag === null) return;
          e.stopPropagation();
          const points = spec.points.map((p, i) => (i === drag ? ([e.point.x, -e.point.z] as Vec2) : p));
          push({ ...spec, points });
        }}
        onPointerUp={endDrag}
        onDoubleClick={(e) => {
          e.stopPropagation();
          const at = insertIndex(spec.points, e.point.x, -e.point.z);
          const points = [...spec.points.slice(0, at), [e.point.x, -e.point.z] as Vec2, ...spec.points.slice(at)];
          set({ selectedHandle: at });
          onChange({ ...spec, points });
        }}
      >
        <planeGeometry args={[6000, 6000]} />
        <meshBasicMaterial />
      </mesh>
      {spec.points.map(([x, y], i) => (
        <mesh
          key={i}
          position={[x, 1.2, -y]}
          onPointerDown={(e) => {
            e.stopPropagation();
            setDrag(i);
            set({ selectedHandle: i });
            if (controls) controls.enabled = false;
          }}
          onPointerUp={endDrag}
        >
          <sphereGeometry args={[i === selected ? 3 : 2.4, 20, 12]} />
          <meshStandardMaterial color={i === selected ? '#ff9f43' : '#4c9aff'} emissive={i === selected ? '#ff9f43' : '#4c9aff'} emissiveIntensity={0.6} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

