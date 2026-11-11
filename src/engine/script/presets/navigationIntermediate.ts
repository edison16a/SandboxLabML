/**
 * Intermediate Navigation preset. It must behave exactly like
 * builtinNavigationController, and a test compares the two runner by
 * runner, so its rewards add up in the same order. It names the Starter
 * brain, which trained best of the three in the reference runs.
 */
export const NAVIGATION_INTERMEDIATE = `// Intermediate: the same rules the app uses when a run has no script.
script "Intermediate: built-in reward" for navigation v1

// navigation-starter sees eight rays, the way to the finish and the path hint.
// The Standard brain sees more, but with four times the inputs it learned
// slower in testing, and scored lower after 60 generations.
brain navigation-starter

// Runs for every runner, 30 times per second.
each tick {
  // Move and turn as the brain says.
  act(move: brain.move, turn: brain.turn)

  // Points for new ground: the whole way is worth 10.
  reward +10 * agent.progressGain
  // Crossing the line is worth 10, plus up to 10 more for time to spare.
  reward +10 + 10 * max(0, 1 - agent.time / agent.timeLimit) when agent.finished
  // Spikes and movers end the run, and cost some of the points already won.
  reward -3 when agent.died
  // Standing still has a small price, so waiting is a choice, not a habit.
  reward -0.005 when abs(agent.speed) < 0.3 m/s
  // So does backing up. It turns tighter than running, and without this
  // a population soon learns to reverse all the way to the line.
  reward -0.03 when agent.speed <= -0.3 m/s
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
