'use client';

import { chapterSizes } from './flow';
import type { Tour } from './types';

/** The welcome card: what the lab is and the chapters the tour walks through. */
export function IntroBody({ tour, titleId, bodyId }: { tour: Tour; titleId: string; bodyId: string }) {
  const { intro } = tour;
  const sizes = chapterSizes(tour);
  return (
    <>
      <div className="flex size-10 items-center justify-center rounded-lg border border-border-strong bg-surface-3 text-accent [&_svg]:size-5">{intro.icon}</div>
      <h2 id={titleId} className="mt-4 text-[18px] leading-tight font-semibold tracking-tight text-fg">
        {intro.title}
      </h2>
      <p id={bodyId} className="mt-2 text-[13px] leading-relaxed text-muted">
        {intro.body}
      </p>
      <ol className="mt-4 flex flex-col divide-y divide-border overflow-hidden rounded-lg border border-border bg-surface">
        {intro.chapters.map((c, i) => (
          <li key={c.label} className="flex items-center gap-3 px-3 py-2.5">
            <span className="flex text-accent [&_svg]:size-4">{c.icon}</span>
            <span className="text-[13px] font-medium text-fg">{c.label}</span>
            <span className="ml-auto text-[11px] text-subtle">{sizes[i]} steps</span>
          </li>
        ))}
      </ol>
    </>
  );
}
