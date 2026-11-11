import type { Metadata } from 'next';
import { Suspense } from 'react';
import { DrivingPreview } from '@/render/driving/preview/DrivingPreview';

export const metadata: Metadata = {
  title: 'Driving preview',
  description: 'The self driving city on its own, driven by autopilots.',
  robots: { index: false, follow: false },
};

/** An unlinked page for judging the city's look before the lab exists. */
export default function DrivingPreviewPage() {
  return (
    <Suspense>
      <DrivingPreview />
    </Suspense>
  );
}
