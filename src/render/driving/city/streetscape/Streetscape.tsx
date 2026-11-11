'use client';

import { useMemo } from 'react';
import type { City } from '@/engine/driving/city/types';
import type { DrivingTier } from '../../quality';
import { Furniture } from './Furniture';
import { streetscapeFor } from './layout';
import { Signals } from './Signals';

/** Everything on the sidewalks: signals, lamps, trees and the odd bench, laid out once per city. */
export function Streetscape({ city, tier }: { city: City; tier: DrivingTier }) {
  const street = useMemo(() => streetscapeFor(city), [city]);
  return (
    <>
      <Signals street={street} />
      <Furniture street={street} tier={tier} />
    </>
  );
}
