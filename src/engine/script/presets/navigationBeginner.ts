/**
 * Beginner Navigation preset: the two rewards that matter most, a small
 * brain and default evolution. It has no death penalty on purpose, which
 * the lessons and the Intermediate preset then add.
 */
export const NAVIGATION_BEGINNER = `// Beginner: teach runners to reach the finish line.
// Lines that start with // are comments. They explain the script and do nothing.
script "Beginner: first runs" for navigation v1

// The brain is a small neural network that moves the runner.
// navigation-starter sees eight rays, the way to the finish and the path hint,
// an arrow along the shortest way round whatever is in the way.
brain navigation-starter

// This block runs for every runner, 30 times per second.
each tick {
  // Move and turn exactly as the brain says.
  act(move: brain.move, turn: brain.turn)

  // Points for new ground: the whole way to the line is worth 10.
  // Paying a little for every step lets evolution tell a good try from a bad one.
  reward +10 * agent.progressGain
  // A bonus for crossing the line, so finishing beats getting close.
  reward +10 when agent.finished
}

// This block runs once per generation, after every runner has stopped.
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
}
`;
