/**
 * Intermediate racing preset. It must behave exactly like
 * builtinRacingController, and a test compares the two car by car.
 */
export const RACING_INTERMEDIATE = `// Intermediate: the same rules the app uses when a run has no script.
script "Intermediate: built-in reward" for racing v1

// racing-standard sees nine distance rays, its speed and the angle to the road.
brain racing-standard

// Runs for every car, 30 times per second.
each tick {
  // Steer and press the pedal as the brain says.
  drive(steer: brain.steer, pedal: brain.pedal)

  // A tiny reward for speed, every tick, so faster cars score higher.
  // It is listed first so the points add up in the same order as the built-in reward.
  reward +0.002 * car.speed
  // One point for each checkpoint, one every 10 m of road.
  reward +1 when checkpoint.passed
  // A big bonus for finishing a whole lap.
  reward +10 when lap.completed

  // Crossing the white edge line ends the run.
  stop "crash" when car.offTrack
  // So does going 3 seconds without getting further along the road.
  stop "stalled" when car.noProgress > 3 s
}

// Runs once per generation and sets how the next brains are bred.
each generation {
  // Aim for 8 species of similar brains.
  speciate(target: 8)
  // The best 20% of each species become parents.
  select(top: 20%)
  // Mix two parents 75% of the time, then mutate: nudge weights often,
  // and now and then add a connection or a neuron so brains can grow.
  breed(crossover: 0.75, mutate: { weights: 0.8, addConnection: 0.05, addNode: 0.03, toggle: 0.01 })
  // Copy each species' best brain into the next generation unchanged.
  keepChampions()
}
`;
