/** Beginner racing preset: reward checkpoints only, a small brain, one fixed track and default evolution. */
export const RACING_BEGINNER = `// Beginner: teach cars to drive laps of the Oval.
// Lines that start with // are comments. They explain the script and do nothing.
script "Beginner: first laps" for racing v1

// The brain is a small neural network that drives the car.
// racing-starter sees three distance rays (left, ahead, right) and its speed.
brain racing-starter

// This block runs for every car, 30 times per second of driving.
each tick {
  // Steer and press the pedal exactly as the brain says.
  drive(steer: brain.steer, pedal: brain.pedal)

  // One point each time the car passes a checkpoint.
  // Checkpoints sit every 10 m along the road, so points mean progress.
  reward +1 when checkpoint.passed

  // Leaving the road ends this car's run, so cars learn to stay on it.
  stop "crash" when car.offTrack
  // A car that has not moved forward for 5 seconds is stuck, so stop it too.
  stop "stalled" when car.noProgress > 5 s
}

// This block runs once per generation, after every car has stopped.
// It sets how the next generation of brains is made from the best ones.
each generation {
  // Group similar brains into about 8 species, so new ideas get time to grow.
  speciate(target: 8)
  // Only the best fifth of each species gets to have children.
  select(top: 20%)
  // A child mixes two parents 75% of the time, then changes a little at random.
  breed(crossover: 0.75, mutate: { weights: 0.8, addConnection: 0.05, addNode: 0.03, toggle: 0.01 })
  // The best brain of each species moves on unchanged, so it is never lost.
  keepChampions()
  // Always race on the Oval, the easiest track.
  useTrack(id: "oval")
}
`;
