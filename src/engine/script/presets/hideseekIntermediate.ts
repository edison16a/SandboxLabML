/**
 * Intermediate Hide and Seek preset. Its each tick block must score exactly
 * like the built-in v1 rewards, and a test plays full matches with both and
 * compares the results.
 */
export const HIDESEEK_INTERMEDIATE = `// Intermediate: the same rewards the app uses when a run has no script.
script "Intermediate: built-in rewards" for hideseek v1

// hideseek-standard sees sixteen rays that also tell walls, boxes and players apart,
// its velocity, whether it holds a box, the phase, the time left and where the
// other player is or was last seen.
brain hideseek-standard

// Runs for every player, 30 times per second.
each tick {
  // Move, turn, grab and lock as the brain says.
  act(move: brain.move, turn: brain.turn, grab: brain.grab, lock: brain.lock)

  // The game is zero sum: whatever one team wins, the other loses.
  // Nothing scores during prep, while the seeker is frozen and blind.
  if agent.isHider {
    // +1 per second hidden, -1 per second seen.
    reward +1 * dt when agent.hidden
    reward -1 * dt when agent.seen
  } else {
    // +1 per second the hider is in sight, -1 per second it is not.
    reward +1 * dt when agent.seesOpponent
    reward -1 * dt when not agent.prep and not agent.seesOpponent
  }
}

// Runs once per generation for each team, and sets how the next brains are bred
// and who they play.
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
  // Each brain plays two rounds against the other team's current brains
  // and two against past champions, so neither team forgets old tricks.
  opponents(current: 2, hallOfFame: 2)
  // Keep the 20 most recent champions of each team as opponents.
  hallOfFame(size: 20)
  // Take turns between the open room and the room with a shelter, one room per round,
  // with every match starting from its own random spots. These are the original rules.
  useLayout(id: "open")
  useLayout(id: "shelter")
  mixLayouts(enabled: false)
  sameStarts(enabled: false)
}
`;
