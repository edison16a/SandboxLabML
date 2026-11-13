/**
 * Beginner driving preset: progress and arriving, two costs (leaving the
 * road and running a red light), a small brain and the automatic
 * curriculum. Without the red light cost its champions run reds forever,
 * and a run never leaves the traffic lights level.
 */
export const DRIVING_BEGINNER = `// Beginner: teach SUVs to find their way on quiet streets.
// Lines that start with // are comments. They explain the script and do nothing.
script "Beginner: first trips" for driving v1

// The brain is a small neural network that drives the SUV.
// driving-starter sees five lidar beams, its lane, its route, the light ahead and its speed.
brain driving-starter

// This block runs for every SUV, 30 times per second of driving.
each tick {
  // Steer and press the pedal exactly as the brain says.
  drive(steer: brain.steer, pedal: brain.pedal)

  // A little for every meter of new ground along the route, so progress pays.
  reward +0.02 * route.gain
  // A big prize for arriving at the destination.
  reward +10 when car.arrived
  // Leaving the road ends the trip, and costs a couple of points on top.
  reward -2 when car.offRoad
  // Running a red light costs as much. Without this cost, running reds would pay best.
  reward -2 when rules.ranRedLight

  // A brain that parks is going nowhere, so its trip ends after 8 seconds of that.
  // Waiting at a red light or for a person does not count as parking.
  stop "stuck" when car.noProgress > 8 s
}

// This block runs once per generation, after every SUV has stopped.
// It sets how the next generation of brains is made from the best ones.
each generation {
  // Group similar brains into about 5 species, so new ideas get time to grow.
  speciate(target: 5)
  // Only the best fifth of each species gets to have children.
  select(top: 20%)
  // A child mixes two parents 75% of the time, then changes a little at random.
  breed(crossover: 0.75, mutate: { weights: 0.8, addConnection: 0.05, addNode: 0.03, toggle: 0.01 })
  // The best brain of each species moves on unchanged, so it is never lost.
  keepChampions()
  // Move up a level once last generation's champions arrive safely on half their new trips.
  // A trip with a red light run is not safe, so stopping at red is what moves a run past level 2.
  autoLevel(share: 50%)
}
`;
