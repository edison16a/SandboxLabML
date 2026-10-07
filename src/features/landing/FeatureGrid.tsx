import { BookOpen, Boxes, Car, Code2, Gauge, ShieldCheck, Users, Waypoints } from 'lucide-react';

const FEATURES = [
  {
    icon: Car,
    title: 'Racing with real grip',
    body: 'A bicycle car model with a friction circle. Braking and turning share the tires, so cars have to learn braking points before every corner.',
  },
  {
    icon: Waypoints,
    title: 'Overlay generations',
    body: 'Past champions drive as ghosts beside the live population, with a speed trace that shows braking points moving later as they learn.',
  },
  {
    icon: Users,
    title: 'Hide and Seek in 3D',
    body: 'Hiders lock boxes into forts, seekers push ramps to jump the walls. Watch all 50 matches of a round at once, then click one to see it up close.',
  },
  {
    icon: Code2,
    title: 'Script Studio',
    body: 'Write the training loop as blocks or code. Both views edit one script, with docs, autocorrect and a test run built in.',
  },
  {
    icon: Boxes,
    title: 'Brains you can read',
    body: 'Pick a blueprint, add sensors, and see every neuron fire live. The model card tracks parameters and size as the brain grows.',
  },
  {
    icon: BookOpen,
    title: 'Guided courses',
    body: 'Short lessons that build a training script step by step, each one checked by running it.',
  },
  {
    icon: Gauge,
    title: 'A fair benchmark',
    body: 'Score any model on held-out tracks and compare it with reference runs, whatever reward or sensors it was trained with.',
  },
  {
    icon: ShieldCheck,
    title: 'Private and local',
    body: 'Training runs in Web Workers and runs are saved in your browser. Export a run as a file whenever you want to share it.',
  },
];

/** The eight feature cards under the hero. */
export function FeatureGrid() {
  return (
    <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
      {FEATURES.map(({ icon: Icon, title, body }) => (
        <div key={title} className="flex flex-col gap-2 bg-surface p-5">
          <Icon className="size-5 text-accent" />
          <h3 className="text-[15px] font-semibold">{title}</h3>
          <p className="text-[13px] leading-relaxed text-muted">{body}</p>
        </div>
      ))}
    </div>
  );
}
