import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LogoMark } from '@/ui/brand/Logo';

/** A quiet text link inside the hero's secondary line. */
function SubLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    // Lab routes carry three.js and Rapier; prefetching them would make the landing page heavy.
    <Link href={href} prefetch={false} className="rounded-sm font-medium text-fg underline decoration-white/30 underline-offset-4 transition-colors hover:decoration-fg">
      {children}
    </Link>
  );
}

/**
 * The centered words of the hero: the mark, the name, one line on what
 * the app does and the way in. Everything here is plain server rendered
 * HTML, so it paints before any script runs.
 */
export function HeroContent() {
  return (
    <div data-hero-content className="relative z-20 flex w-full max-w-4xl flex-col items-center px-6 text-center">
      <LogoMark size={64} pulse className="max-sm:size-12" />
      <h1 id="hero-title" className="mt-6 text-[44px] leading-none font-semibold tracking-tight text-fg sm:text-7xl 2xl:text-[88px]">
        SandboxLab<span className="text-accent">ML</span>
      </h1>
      <p className="mt-5 max-w-3xl text-[18px] leading-snug text-balance text-fg/90 sm:text-[21px] 2xl:text-[22px]">Train your own model with machine learning, right in your browser.</p>
      <Link
        href="/lab/racing"
        prefetch={false}
        className="mt-9 inline-flex h-12 items-center gap-2 rounded-lg bg-accent px-7 text-[16px] font-semibold text-[#06101f] transition-colors hover:bg-[#62a8ff] focus-visible:outline-fg"
      >
        Go Train
        <ArrowRight className="size-[18px]" aria-hidden="true" />
      </Link>
      <p className="mt-6 text-[14px] text-balance text-fg/85">
        Or play <SubLink href="/lab/hide-seek">Hide and Seek</SubLink>, or write your own rules in the <SubLink href="/studio">Studio</SubLink>.
      </p>
      <p className="mt-2 text-[12px] text-fg/70">No account, no server. Your runs stay in this browser.</p>
    </div>
  );
}
