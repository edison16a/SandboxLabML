import type { Metadata } from 'next';
import { Workspace } from '@/features/shell/Workspace';

export const metadata: Metadata = { title: 'Hide and Seek' };

export default function Page() {
  return (
    <Workspace>
      <div className="p-8 text-muted">Hide and Seek</div>
    </Workspace>
  );
}
