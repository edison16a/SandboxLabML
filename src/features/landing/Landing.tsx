import { GitHubButton } from '@/ui/brand/GitHubButton';
import { FeatureGrid } from './FeatureGrid';
import { Hero } from './hero/Hero';
import { Steps } from './Steps';

/** A section title, shared by the parts below the hero. */
function SectionHead({ id, title }: { id: string; title: string }) {
  return (
    <h2 id={id} className="mb-8 text-2xl font-semibold tracking-tight">
      {title}
    </h2>
  );
}

/**
 * The landing page: a full screen hero with the live scenes, then how it
 * works, what is inside and the footer. Everything below the hero is
 * static HTML.
 */
export function Landing() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <Hero />

      <section aria-labelledby="how" className="mx-auto max-w-6xl px-4 pt-20 pb-10 sm:px-8">
        <SectionHead id="how" title="How it works" />
        <Steps />
      </section>

      <section aria-labelledby="inside" className="mx-auto max-w-6xl px-4 pt-10 pb-20 sm:px-8">
        <SectionHead id="inside" title="What is inside" />
        <FeatureGrid />
      </section>

      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 border-t border-border px-4 py-8 text-[13px] text-muted sm:px-8">
        <span>Open source, MIT license.</span>
        <GitHubButton />
      </footer>
    </div>
  );
}
