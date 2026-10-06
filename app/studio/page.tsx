import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Workspace } from '@/features/shell/Workspace';
import { StudioApp } from '@/studio/StudioApp';

export const metadata: Metadata = {
  title: 'Studio',
  description: 'Write training scripts in SBL as code or blocks, test them on a track and learn the language step by step.',
};

export default function StudioPage() {
  return (
    <Workspace>
      <Suspense>
        <StudioApp />
      </Suspense>
    </Workspace>
  );
}
