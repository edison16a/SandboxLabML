import type { Metadata } from 'next';
import { Workspace } from '@/features/shell/Workspace';

export const metadata: Metadata = { title: 'Studio' };

export default function Page() {
  return (
    <Workspace>
      <div className="p-8 text-muted">Studio</div>
    </Workspace>
  );
}
