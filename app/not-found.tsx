import type { Metadata } from 'next';
import Link from 'next/link';
import { Workspace } from '@/features/shell/Workspace';
import { LABS } from '@/features/shell/labs';

export const metadata: Metadata = {
  title: 'Page not found',
};

/** The 404 page: what happened in one line, then the way back to the labs, the Studio and the home page. */
export default function NotFound() {
  return (
    <Workspace>
      <div className="flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex max-w-md flex-col items-center gap-5 text-center">
          <p className="font-mono text-[13px] text-subtle">404</p>
          <h1 className="text-2xl font-semibold tracking-tight">This page does not exist</h1>
          <p className="text-[14px] text-muted">The link may be old, or the address has a typo.</p>
          <nav className="flex flex-wrap justify-center gap-2" aria-label="Places to go">
            {LABS.map((lab, i) => (
              <Link
                key={lab.env}
                href={lab.path}
                prefetch={false}
                className={
                  i === 0
                    ? 'inline-flex h-9 items-center gap-1.5 rounded-md bg-accent px-3.5 text-[13px] font-semibold text-[#06101f] hover:bg-[#62a8ff]'
                    : 'inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3.5 text-[13px] hover:bg-surface-2'
                }
              >
                <lab.icon className="size-4" />
                {lab.label}
              </Link>
            ))}
            <Link href="/studio" className="inline-flex h-9 items-center rounded-md border border-border px-3.5 text-[13px] hover:bg-surface-2">
              Studio
            </Link>
            <Link href="/" className="inline-flex h-9 items-center rounded-md border border-border px-3.5 text-[13px] hover:bg-surface-2">
              Home
            </Link>
          </nav>
        </div>
      </div>
    </Workspace>
  );
}
