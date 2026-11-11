import type { Metadata } from 'next';
import { Suspense } from 'react';
import { NavigationPreview } from '@/render/navigation/preview/NavigationPreview';

export const metadata: Metadata = {
  title: 'Navigation preview',
  robots: { index: false },
};

/** An unlinked page for judging the Navigation world before its lab exists. */
export default function NavigationPreviewPage() {
  return (
    <Suspense>
      <NavigationPreview />
    </Suspense>
  );
}
