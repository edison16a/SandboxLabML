'use client';

/** A titled part of a test result, such as the reward chart or the tick table. */
export function ResultSection({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[12px] font-semibold tracking-wide text-muted uppercase">{title}</h3>
        {hint && <span className="text-[11px] text-subtle">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
