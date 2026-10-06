import type { Metadata } from 'next';
import { Workspace } from '@/features/shell/Workspace';
import { RunsPage } from '@/features/runs/RunsPage';

export const metadata: Metadata = {
  title: 'Runs',
  description: 'Every training run saved in this browser, with export, branching, rewind and Trash.',
};

export default function Page() {
  return (
    <Workspace>
      <RunsPage />
    </Workspace>
  );
}
