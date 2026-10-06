'use client';

import { useEffect, useRef } from 'react';
import { stepCar } from '@/engine/racing/car/dynamics';
import { DEFAULT_CAR } from '@/engine/racing/car/params';
import { createRacingCar, updateTrackState, type RacingCar } from '@/engine/racing/car/runtime';
import { scriptedDriver } from '@/engine/racing/scriptedDriver';
import { buildTrack } from '@/engine/racing/track/buildTrack';
import { BUILT_IN_TRACKS } from '@/engine/racing/track/presets';

const CARS = 9;

/**
 * A live, top-down hero animation drawn on a 2D canvas: the real car model
 * and track code, driven by the scripted driver at different caution levels,
 * leaving fading trails. No three.js, so the landing page stays light.
 */
export function HeroTrack() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    const g = canvas?.getContext('2d');
    if (!canvas || !g) return;
    const track = buildTrack(BUILT_IN_TRACKS[4]);
    const params = Array.from({ length: CARS }, (_, i) => ({ ...DEFAULT_CAR, grip: DEFAULT_CAR.grip * (0.55 + i * 0.06) }));
    const cars: RacingCar[] = params.map((_, i) => createRacingCar(i, track, 0));
    const act = new Float64Array(2);
    const trails = cars.map(() => [] as Array<[number, number]>);
    // Stagger starts so the cars spread around the lap.
    cars.forEach((rc, i) => {
      for (let t = 0; t < i * 175; t++) {
        scriptedDriver(rc, track, params[i], act);
        stepCar(rc.car, act[0], act[1], params[i]);
        updateTrackState(rc, track);
      }
    });
    const { minX, minY, maxX, maxY } = track.bounds;
    let raf = 0;
    let last = performance.now();
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const frame = (now: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (canvas.width !== w * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
      }
      const ticks = reduce ? 0 : Math.min(4, Math.round((now - last) / (1000 / 30)));
      if (ticks > 0) last = now;
      cars.forEach((rc, i) => {
        for (let t = 0; t < ticks; t++) {
          scriptedDriver(rc, track, params[i], act);
          stepCar(rc.car, act[0], act[1], params[i]);
          updateTrackState(rc, track);
          trails[i].push([rc.car.x, rc.car.y]);
          if (trails[i].length > 90) trails[i].shift();
        }
      });
      const scale = Math.min(w / (maxX - minX + 40), h / (maxY - minY + 40));
      const ox = w / 2 - ((minX + maxX) / 2) * scale;
      const oy = h / 2 + ((minY + maxY) / 2) * scale;
      const X = (x: number) => ox + x * scale;
      const Y = (y: number) => oy - y * scale;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      g.lineJoin = 'round';
      g.strokeStyle = '#1b212d';
      g.lineWidth = track.spec.width * scale;
      g.beginPath();
      for (let i = 0; i <= track.count; i++) g.lineTo(X(track.cx[i % track.count]), Y(track.cy[i % track.count]));
      g.stroke();
      g.strokeStyle = '#2f3848';
      g.lineWidth = 1;
      for (const [ex, ey] of [[track.leftX, track.leftY], [track.rightX, track.rightY]]) {
        g.beginPath();
        for (let i = 0; i <= track.count; i++) g.lineTo(X(ex[i % track.count]), Y(ey[i % track.count]));
        g.stroke();
      }
      cars.forEach((rc, i) => {
        const color = i % 3 === 0 ? '255,159,67' : '76,154,255';
        const trail = trails[i];
        for (let k = 1; k < trail.length; k++) {
          g.strokeStyle = `rgba(${color},${(k / trail.length) * 0.55})`;
          g.lineWidth = 2;
          g.beginPath();
          g.moveTo(X(trail[k - 1][0]), Y(trail[k - 1][1]));
          g.lineTo(X(trail[k][0]), Y(trail[k][1]));
          g.stroke();
        }
        g.save();
        g.translate(X(rc.car.x), Y(rc.car.y));
        g.rotate(-rc.car.heading);
        g.fillStyle = `rgb(${color})`;
        g.beginPath();
        g.roundRect(-6, -3, 12, 6, 2);
        g.fill();
        g.restore();
      });
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} className="h-full w-full" aria-hidden="true" />;
}
