/**
 * Advanced Hide and Seek preset: the v2 training setup written out (cover
 * rewards, scripted sparring and mixed rooms), plus a shelter bonus,
 * seeker approach shaping, a hall of fame schedule that starts with two
 * sparring rounds, and a shrinking prep phase.
 */
export const HIDESEEK_ADVANCED = `// Advanced: real cover, shelters that stay built and a curriculum.
script "Advanced: cover and shelters" for hideseek v1

// hideseek-advanced sees what Standard sees plus where the two nearest boxes are
// and whether they are locked, which makes shelters easier to find.
brain hideseek-advanced

// Runs for every player, 30 times per second.
each tick {
  // Move, turn, grab and lock as the brain says.
  act(move: brain.move, turn: brain.turn, grab: brain.grab, lock: brain.lock)

  if agent.isHider {
    // Cover rewards. Exposed means the seeker would see the hider just by turning.
    // Points come only from real cover (out of range, or behind a wall or box),
    // so hiders learn to hide even while the seekers are still clumsy.
    reward +1 * dt when agent.hidden and not agent.exposed
    reward -1 * dt when agent.seen
    // Shelter bonus: a little extra for every locked box while still hidden.
    reward +0.1 * dt * agent.boxesLocked when agent.hidden
  } else {
    // The mirror image for seekers: a line of sight is worth 0, sight is worth +1.
    reward +1 * dt when agent.seesOpponent
    reward -1 * dt when not agent.prep and not agent.exposed
    // Approach shaping: before the first sighting, a little for getting close.
    reward +0.2 * dt when not agent.prep and agent.lastSeenAge > 30 s and agent.opponentDistance < 8 m
  }
}

// Runs once per generation for each team.
each generation {
  // Aim for 10 species, steering structural mutation toward that count.
  speciate(target: 10, adaptive: true)
  select(top: 20%)
  breed(crossover: 0.75, mutate: { weights: 0.8, addConnection: 0.05, addNode: 0.03, toggle: 0.01 }, adaptive: true)
  keepChampions()

  // Hall of fame schedule. Early on the hall only holds clumsy champions, so two
  // rounds go to the scripted sparring partners: a fixed opponent that tells
  // good brains from lucky ones. Later one of those rounds goes to past champions,
  // so neither team forgets how to beat an old trick.
  if generation < 30 {
    opponents(current: 2, scripted: 2)
  } else {
    opponents(current: 2, hallOfFame: 1, scripted: 1)
  }
  hallOfFame(size: 20)

  // Curriculum: a long prep phase gives new hiders time to reach cover,
  // then it shrinks to the standard 9 seconds.
  if generation < 10 {
    prepTime(length: 12 s)
  } else if generation < 20 {
    prepTime(length: 10.5 s)
  } else {
    prepTime(length: 9 s)
  }

  // Every room, mixed inside each round, so the share of time hidden from the
  // scripted seeker can be compared from one generation to the next.
  useLayout(id: "open")
  useLayout(id: "shelter")
  useLayout(id: "corridor")
  mixLayouts()
}
`;
