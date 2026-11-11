/**
 * Advanced driving preset: the Intermediate rules, two habits that keep
 * people and cars ahead safe, and new random cities once the lights are
 * learned, so the brain is ready for streets it has never seen (which is
 * what the benchmark drives). It drives the run's own trips per
 * generation, three in a new run.
 */
export const DRIVING_ADVANCED = `// Advanced: careful drivers for cities they have never seen.
script "Advanced: new streets, safer habits" for driving v1

// The standard brain: nine lidar beams plus every road sensor.
brain driving-standard

// Runs for every SUV, 30 times per second.
each tick {
  drive(steer: brain.steer, pedal: brain.pedal)

  // The built-in rewards: progress, a slow approach and arriving.
  reward +0.02 * route.gain
  reward +0.1 * route.gain * (1 - min(1, car.speed / 8 m/s)) when route.remaining < 30 m
  reward +10 when car.arrived

  // The built-in costs for breaking a rule.
  reward -2 when rules.ranRedLight
  reward -0.3 when rules.overranStopLine
  reward -0.005 when rules.speeding
  reward -0.01 when rules.wrongWay
  reward -0.002 when rules.laneDeparture
  reward -0.01 when car.overCurb
  reward -2 when car.crashed
  reward -4 when car.hitPedestrian

  // Two habits a crash only teaches too late.
  // Being fast close to a person costs a little every tick, so brains slow down early.
  reward -0.02 when person.ahead and person.distance < 10 m and car.speed > 3 m/s
  // Staying closer than a second and a half behind another car costs a little too.
  reward -0.01 when carAhead.seen and carAhead.gap < 1.5 s * car.speed

  stop "redlight" when rules.ranRedLight
  stop "stuck" when car.noProgress > 8 s
}

// Runs once per generation and sets how the next brains are bred.
each generation {
  speciate(target: 5)
  select(top: 20%)
  breed(crossover: 0.75, mutate: { weights: 0.8, addConnection: 0.05, addNode: 0.03, toggle: 0.01 })
  keepChampions()

  // Once the lights are learned, every other generation drives a new random city.
  // A brain that only ever sees Midtown learns Midtown. New streets teach it to read the road.
  if curriculum.level >= 3 and generation % 2 == 1 {
    randomCity(seed: generation)
  }
  if curriculum.level >= 3 and generation % 2 == 0 {
    useCity(id: "midtown")
  }
}
`;
