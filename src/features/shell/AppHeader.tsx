'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Car, Code2, FolderOpen, Users } from 'lucide-react';
import { Logo } from '@/ui/brand/Logo';
import { GitHubButton } from '@/ui/brand/GitHubButton';
import { cn } from '@/ui/cn';

const NAV = [
  { href: '/lab/racing', label: 'Racing', icon: Car },
  { href: '/lab/hide-seek', label: 'Hide and Seek', icon: Users },
  { href: '/studio', label: 'Studio', icon: Code2 },
  { href: '/runs', label: 'Runs', icon: FolderOpen },
] as const;

/** Top bar shared by every page: logo on the left, sections, then GitHub. */
export function AppHeader({ right }: { right?: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <header className="flex h-12 shrink-0 items-center gap-4 border-b border-border bg-bg px-4">
      <Link href="/" aria-label="SandboxLabML home" className="rounded-md">
        <Logo />
      </Link>
      <nav className="no-scrollbar flex min-w-0 items-center gap-0.5 overflow-x-auto" aria-label="Sections">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              // Lab routes carry three.js and Rapier; prefetching them would make every page heavy.
              prefetch={false}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors',
                active ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface hover:text-fg',
              )}
            >
              <Icon className="size-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="ml-auto flex items-center gap-2">
        {right}
        <GitHubButton className="hidden md:inline-flex" />
        <GitHubButton compact className="md:hidden" />
      </div>
    </header>
  );
}
