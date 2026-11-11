import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DrivingLab } from '@/features/driving/components/DrivingLab';
import { Workspace } from '@/features/shell/Workspace';

export const metadata: Metadata = {
  title: 'Self-driving',
  description: 'Watch a population of neural networks learn to drive an SUV through a city: lanes, turns, red lights, people and traffic.',
};

export default function DrivingPage() {
  return (
    <Workspace>
      <Suspense>
        <DrivingLab />
      </Suspense>
    </Workspace>
  );
}
