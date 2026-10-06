import { Workspace } from '@/features/shell/Workspace';
import { Landing } from '@/features/landing/Landing';

export default function HomePage() {
  return (
    <Workspace>
      <Landing />
    </Workspace>
  );
}
