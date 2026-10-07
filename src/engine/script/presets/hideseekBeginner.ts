/**
 * Beginner Hide and Seek preset: the gentle Starter rewards, a small brain
 * and the open room. Its each tick block scores exactly like the built-in
 * Starter rewards.
 */
export const HIDESEEK_BEGINNER = `// Beginner: hiders learn to stay out of sight, seekers learn to find them.
// Lines that start with // are comments. They explain the script and do nothing.
script "Beginner: first game of hide and seek" for hideseek v1

// Every hider and every seeker has a brain: a small neural network.
// hideseek-starter sees eight distance rays, its speed, whether the other
// player is in sight, whether it is the prep phase and the nearest ramp.
brain hideseek-starter

// This block runs for every player, 30 times per second of the match.
each tick {
  // Move, turn, grab and lock exactly as the brain says.
  act(move: brain.move, turn: brain.turn, grab: brain.grab, lock: brain.lock)

  // One script trains both teams, so first check which team this player is on.
  if agent.isHider {
    // Hiders score while the seeker cannot see them.
    // dt is one tick (1/30 of a second), so this adds up to 1 point per second.
    reward +1 * dt when agent.hidden
  } else {
    // Seekers score while they can see the hider.
    reward +1 * dt when agent.seesOpponent
  }
}

// This block runs once per generation for each team, after every match is over.
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
  // Play every match in the open room, the simplest one.
  useLayout(id: "open")
}
`;
