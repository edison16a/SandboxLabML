import type { Metadata } from 'next';
import { Suspense } from 'react';
import { HideSeekLab } from '@/features/hideseek/components/HideSeekLab';
import { Workspace } from '@/features/shell/Workspace';

export const metadata: Metadata = {
  title: 'Hide and Seek',
  description: 'Watch two teams of neural networks co-evolve: hiders learn to build shelters, seekers learn to find them.',
};

export default function HideSeekPage() {
  return (
    <Workspace>
      <Suspense>
        <HideSeekLab />
      </Suspense>
    </Workspace>
  );
}
