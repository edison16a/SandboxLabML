'use client';

import { useMemo, type MouseEvent } from 'react';
import { cityFor } from '@/engine/driving/city/buildCity';
import { ROAD_HALF } from '@/engine/driving/city/dimensions';
import { nearestLanePoint } from '@/engine/driving/sandbox';
import type { DrivingSetup } from '@/engine/driving/setup';
import { buildDrivingWorld } from '@/engine/driving/setup';

/** Room around the street grid, m, so the outer streets are not cut by the frame. */
const PAD = 10;

interface Props {
  setup: DrivingSetup;
  onPick: (destination: { element: number; s: number }) => void;
}

/**
 * A plan of the Sandbox city with the trip on it: the blocks, the route
 * from the start dot to the destination flag, and the streets as the
 * space between. Clicking a street sends the SUVs there. North is up, as
 * in the simulation, so the SVG flips its y.
 */
export function CityMap({ setup, onPick }: Props) {
  const city = useMemo(() => cityFor(setup.city), [setup.city]);
  const route = useMemo(() => buildDrivingWorld(setup).route, [setup]);
  const b = city.bounds;
  const box = { x: b.minX - PAD, y: b.minY - PAD, w: b.maxX - b.minX + 2 * PAD, h: b.maxY - b.minY + 2 * PAD };
  const path = useMemo(() => {
    const p = route.path;
    const parts: string[] = [];
    for (let s = route.startS; s < route.destS; s += 3) {
      const i = p.indexAt(s);
      parts.push(`${p.x[i].toFixed(1)},${p.y[i].toFixed(1)}`);
    }
    return parts.join(' ');
  }, [route]);
  const at = (s: number) => {
    const i = route.path.indexAt(s);
    return { x: route.path.x[i], y: route.path.y[i] };
  };
  const start = at(route.startS);
  const end = at(route.destS);

  const click = (e: MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const local = pt.matrixTransform(svg.getScreenCTM()?.inverse());
    // The map is drawn flipped, so a click's y is minus the world's.
    const picked = nearestLanePoint(city, local.x, -local.y, 9);
    if (picked) onPick(picked);
  };

  return (
    <svg
      viewBox={`${box.x} ${-box.y - box.h} ${box.w} ${box.h}`}
      className="aspect-[4/3] w-full cursor-crosshair rounded-md border border-white/10 bg-[#1b212d]"
      onClick={click}
      role="img"
      aria-label="City map. Click a street to drive there."
    >
      <g transform="scale(1,-1)">
        {city.blocks.map((k, i) => (
          <rect key={i} x={k.x0} y={k.y0} width={k.x1 - k.x0} height={k.y1 - k.y0} rx={4} fill="#2b3342" />
        ))}
        <polyline points={path} fill="none" stroke="#4c9aff" strokeWidth={ROAD_HALF * 0.9} strokeLinejoin="round" strokeLinecap="round" opacity={0.9} />
        <circle cx={start.x} cy={start.y} r={4.5} fill="#e7ebf3" stroke="#0b0e14" strokeWidth={1.5} />
        <circle cx={end.x} cy={end.y} r={6.5} fill="#3dd68c" stroke="#0b0e14" strokeWidth={1.5} />
      </g>
    </svg>
  );
}
