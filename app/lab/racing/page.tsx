import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Workspace } from '@/features/shell/Workspace';
import { RacingLab } from '@/features/racing/components/RacingLab';

export const metadata: Metadata = {
  title: 'Racing',
  description: 'Watch a population of neural networks learn to drive, brake and lap a 3D circuit.',
};

export default function RacingPage() {
  return (
    <Workspace>
      <Suspense>
        <RacingLab />
      </Suspense>
    </Workspace>
  );
}
