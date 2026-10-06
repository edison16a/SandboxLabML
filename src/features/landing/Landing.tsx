import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { LogoMark } from '@/ui/brand/Logo';
import { GitHubButton } from '@/ui/brand/GitHubButton';
import { FeatureGrid } from './FeatureGrid';
import { HeroTrack } from './HeroTrack';
import { Steps } from './Steps';

/** The landing page. Static apart from the small hero canvas, so it loads fast. */
export function Landing() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pt-14 pb-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pt-20">
        <div className="flex flex-col gap-6">
          <LogoMark size={44} pulse />
          <h1 className="text-4xl leading-[1.1] font-semibold tracking-tight sm:text-5xl">
            Watch neural networks <span className="text-accent">learn</span>.
          </h1>
          <p className="max-w-xl text-[16px] leading-relaxed text-muted">
            Evolve brains that race cars around a 3D circuit and play hide and seek with boxes. Write the training loop yourself and see every decision as it happens. Everything runs in your browser.
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/lab/racing" prefetch={false} className="inline-flex h-10 items-center gap-2 rounded-md bg-accent px-4 text-[14px] font-semibold text-[#06101f] transition-colors hover:bg-[#62a8ff]">
              Open the Racing lab
              <ArrowRight className="size-4" />
            </Link>
            <Link href="/lab/hide-seek" prefetch={false} className="inline-flex h-10 items-center rounded-md border border-border px-4 text-[14px] font-medium hover:border-border-strong hover:bg-surface">
              Hide and Seek
            </Link>
            <Link href="/studio" className="inline-flex h-10 items-center rounded-md border border-border px-4 text-[14px] font-medium hover:border-border-strong hover:bg-surface">
              Script Studio
            </Link>
          </div>
          <p className="text-[12px] text-subtle">No account, no server. Runs are saved in this browser and can be exported as files.</p>
        </div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl border border-border bg-surface">
          <HeroTrack />
          <div className="absolute bottom-3 left-3 rounded-md border border-border bg-bg/80 px-2 py-1 font-mono text-[11px] text-muted">Grand Prix, live</div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <Steps />
      </section>

      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
        <FeatureGrid />
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-border px-4 py-8 text-[13px] text-muted sm:px-8">
        <span>SandboxLabML is open source under the MIT license.</span>
        <GitHubButton />
      </footer>
    </div>
  );
}
