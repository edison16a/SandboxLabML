/** A titled block of the Progress tab, with an optional hint on the right of the title. */
export function Section({ title, children, hint, tour }: { title: string; children: React.ReactNode; hint?: string; tour?: string }) {
  return (
    <section data-tour={tour} className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[12px] font-semibold tracking-wide text-muted uppercase">{title}</h3>
        {hint && <span className="truncate text-[11px] text-subtle">{hint}</span>}
      </div>
      {children}
    </section>
  );
}
