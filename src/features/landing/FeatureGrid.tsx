import { BookOpen, Boxes, Car, Code2, FlaskConical, Footprints, Gauge, ScanEye } from 'lucide-react';

const FEATURES = [
  {
    icon: Car,
    title: 'Self-driving in a city',
    body: 'Traffic lights, people and other cars share the streets. The SUV learns when to go and when to wait.',
  },
  {
    icon: Footprints,
    title: 'Learn to navigate',
    body: 'A runner starts on a straight run. Crates, walls, spikes and moving blocks arrive as it improves.',
  },
  {
    icon: ScanEye,
    title: 'Sensors you can see',
    body: 'Lidar beams, the route ahead and arrows for where the SUV plans to go.',
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
    title: 'Guided lessons',
    body: 'Short lessons that build a training script step by step.',
  },
  {
    icon: Gauge,
    title: 'A fair benchmark',
    body: 'Champions are scored in cities and rooms they never trained in, so runs compare fairly.',
  },
  {
    icon: FlaskConical,
    title: 'Sandboxes',
    body: 'Pick a trip or draw a course, then watch your champions or a trained model take it on.',
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
