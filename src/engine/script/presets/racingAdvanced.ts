/**
 * Advanced racing preset: the Intermediate rules plus a grip penalty and a
 * curriculum that rotates through every built-in circuit. Benchmarked
 * against variants (bigger brain, random roads, adaptive mutation, an extra
 * lookahead sensor), rotating real circuits generalized best by a wide margin.
 */
export const RACING_ADVANCED = `// Advanced: clean, fast laps on roads the brain has never seen.
script "Advanced: a curriculum of circuits" for racing v1

// The standard brain: nine rays, speed and heading error.
// A bigger brain learns slower and, in testing, generalized worse in the same time.
brain racing-standard

// How much tire slide is fine before it costs points. 0 is full grip, 1 is a full slide.
let slipLimit = 0.3

// Runs for every car, 30 times per second.
each tick {
  // Steer and press the pedal as the brain says.
  drive(steer: brain.steer, pedal: brain.pedal)

  // The built-in rewards: a little for speed, a point per checkpoint, a bonus per lap.
  reward +0.002 * car.speed
  reward +1 when checkpoint.passed
  reward +10 when lap.completed
  // Sliding means the car asked the tires for more grip than they have.
  // A small penalty teaches it to brake before a corner instead of sliding through it.
  reward -0.05 when car.slip > slipLimit

  // Leaving the road or getting stuck ends the run.
  stop "crash" when car.offTrack
  stop "stalled" when car.noProgress > 3 s
}

// Runs once per generation and sets how the next brains are bred.
each generation {
  speciate(target: 8)
  select(top: 20%)
  breed(crossover: 0.75, mutate: { weights: 0.8, addConnection: 0.05, addNode: 0.03, toggle: 0.01 })
  keepChampions()

  // The curriculum: a new circuit every 8 generations, easiest first, then around again.
  // A brain that only ever sees one road memorizes it. Several roads force it to read the road instead.
  if generation % 40 == 8 {
    useTrack(id: "sprint")
  }
  if generation % 40 == 16 {
    useTrack(id: "hairpin")
  }
  if generation % 40 == 24 {
    useTrack(id: "esses")
  }
  if generation % 40 == 32 {
    useTrack(id: "grand-prix")
  }
  if generation % 40 == 0 and generation > 0 {
    useTrack(id: "oval")
  }
}
`;
