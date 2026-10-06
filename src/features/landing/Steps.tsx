const STEPS = [
  ['Pick a brain', 'Choose what the agents sense, from three rays to sixty inputs.'],
  ['Write the rules', 'Rewards, stop rules and how each generation breeds, as blocks or code.'],
  ['Watch it evolve', 'NEAT grows the networks. See every generation drive, crash and improve.'],
  ['Measure it', 'Benchmark the champion against reference runs on tracks it never saw.'],
];

/** The four step strip explaining the loop. */
export function Steps() {
  return (
    <ol className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map(([title, body], i) => (
        <li key={title} className="flex flex-col gap-2">
          <span className="flex size-7 items-center justify-center rounded-full border border-border-strong font-mono text-[12px] text-accent">{i + 1}</span>
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <p className="text-[13px] leading-relaxed text-muted">{body}</p>
        </li>
      ))}
    </ol>
  );
}
