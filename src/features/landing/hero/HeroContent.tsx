import Link from 'next/link';
import type { Ref } from 'react';
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
 * the app does and the way in. They sit on a flat blurred panel, so they
 * read on any frame of either scene while the scenes around them keep
 * their full color. Everything here is plain HTML, so it paints before
 * any script runs. The live scenes measure the panel (through `ref`) to
 * keep their subjects beside it.
 */
export function HeroContent({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div
      ref={ref}
      data-hero-content
      className="relative z-20 mx-5 flex w-full max-w-[30rem] flex-col items-center rounded-2xl border border-white/10 bg-bg/75 px-6 py-8 text-center backdrop-blur-lg sm:px-10 sm:py-9 short:py-5 xl:max-w-[34rem] 2xl:max-w-[38rem]"
    >
      <LogoMark size={56} pulse className="max-sm:size-11 short:size-9" />
      <h1 id="hero-title" className="mt-5 text-[40px] leading-none font-semibold tracking-tight text-fg sm:text-[52px] xl:text-6xl 2xl:text-7xl short:mt-3 short:text-[40px]">
        SandboxLab<span className="text-accent">ML</span>
      </h1>
      <p className="mt-4 text-[17px] leading-snug text-balance text-fg sm:text-[19px] 2xl:text-[21px] short:mt-3 short:text-[16px]">
        Train your own model with machine learning, right in your browser.
      </p>
      <Link
        href="/lab/racing"
        prefetch={false}
        className="mt-7 inline-flex h-12 items-center gap-2 rounded-lg bg-accent px-7 text-[16px] font-semibold text-[#06101f] transition-colors hover:bg-[#62a8ff] focus-visible:outline-fg short:mt-4 short:h-11"
      >
        Go Train
        <ArrowRight className="size-[18px]" aria-hidden="true" />
      </Link>
      <p className="mt-5 text-[14px] text-balance text-fg/85 short:mt-3">
        Or play <SubLink href="/lab/hide-seek">Hide and Seek</SubLink>, or write your own rules in the <SubLink href="/studio">Studio</SubLink>.
      </p>
    </div>
  );
}
