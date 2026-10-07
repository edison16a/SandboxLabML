import { BookOpen, Boxes, Car, Code2, FlaskConical, Gauge, Users, Waypoints } from 'lucide-react';

const FEATURES = [
  {
    icon: Car,
    title: 'Racing with real grip',
    body: 'Braking and turning share the same tire grip, so cars must learn to brake before corners.',
  },
  {
    icon: Waypoints,
    title: 'Overlay generations',
    body: 'Past champions drive as ghosts beside the live cars, so you see the laps get faster.',
  },
  {
    icon: Users,
    title: 'Hide and Seek in 3D',
    body: 'Hiders lock boxes into forts. Seekers push ramps to jump the walls.',
  },
  {
    icon: Code2,
    title: 'Script Studio',
    body: 'Write the training rules as blocks or code. Both views edit the same script.',
  },
  {
    icon: Boxes,
    title: 'Brains you can read',
    body: 'Pick what the agents sense and watch every neuron fire live.',
  },
  {
    icon: BookOpen,
    title: 'Guided courses',
    body: 'Short lessons that build a training script step by step.',
  },
  {
    icon: Gauge,
    title: 'A fair benchmark',
    body: 'Scores a champion on tracks it never trained on, so runs compare fairly.',
  },
  {
    icon: FlaskConical,
    title: 'Sandboxes',
    body: 'Race your champions on a track you draw, or drop them in a room you build.',
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
