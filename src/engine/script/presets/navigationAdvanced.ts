/**
 * Advanced Navigation preset: the Intermediate rules, a sharper cost for
 * dying and for brushing spikes, and more courses per generation once the
 * hazards start, so a lucky room carries less weight. It keeps the
 * Starter brain: the Standard and Advanced brains scored lower after 60
 * generations in the preset experiments (see docs/benchmark.md).
 */
export const NAVIGATION_ADVANCED = `// Advanced: careful runners that finish rooms they have never seen.
script "Advanced: careful runners" for navigation v1

// The small brain again. In testing, brains that see more (spikes and
// movers told apart, speed and time) needed more generations, and one
// without the path hint got lost behind walls. Small and well guided wins.
brain navigation-starter

// How close to the spikes is too close.
let spikeMargin = 0.5 m

// Runs for every runner, 30 times per second.
each tick {
  // Move and turn as the brain says.
  act(move: brain.move, turn: brain.turn)

  // The built-in rewards: new ground, the finish and time to spare.
  reward +10 * agent.progressGain
  reward +10 + 10 * max(0, 1 - agent.time / agent.timeLimit) when agent.finished
  // Dying costs twice as much as in the built-in reward, so runners
  // learn that a safe way round beats a quick way through.
  reward -6 when agent.died
  // A small cost for every tick spent close to spikes. It warns a runner
  // before it is too late, instead of only once it has died.
  reward -0.01 when agent.spikeDistance < spikeMargin
  // Standing still and backing up cost a little, as in the built-in reward.
  reward -0.005 when abs(agent.speed) < 0.3 m/s
  reward -0.03 when agent.speed <= -0.3 m/s
}

// Runs once per generation and sets how the next brains are bred.
each generation {
  speciate(target: 8)
  select(top: 20%)
  breed(crossover: 0.75, mutate: { weights: 0.8, addConnection: 0.05, addNode: 0.03, toggle: 0.01 })
  keepChampions()

  // From the spikes on, every brain runs three courses instead of two.
  // A brain that only got lucky in one room now has to do it again.
  if course.level >= 3 {
    coursesPerGeneration(count: 3)
  }
}
`;
