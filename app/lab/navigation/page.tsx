import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Workspace } from '@/features/shell/Workspace';
import { NavigationLab } from '@/features/navigation/components/NavigationLab';

export const metadata: Metadata = {
  title: 'Navigation',
  description: 'Watch a population of neural networks learn to reach the finish line round crates, spikes, walls and moving blocks.',
};

export default function NavigationPage() {
  return (
    <Workspace>
      <Suspense>
        <NavigationLab />
      </Suspense>
    </Workspace>
  );
}
