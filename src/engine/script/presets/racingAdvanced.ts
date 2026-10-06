/** Advanced racing preset: grip penalty, curvature lookahead, adaptive mutation and random tracks. */
export const RACING_ADVANCED = `// Advanced: fast and clean laps on roads the brain has never seen.
script "Advanced: grip and new roads" for racing v1

// racing-advanced also sees the wheel angle, how the road bends 15 m and 40 m ahead,
// and how much the tires slide.
brain racing-advanced

// One extra brain input: how sharply the road bends 60 m ahead, far enough to brake in time.
// The range maps a tight right bend to 0, a straight to 0.5 and a tight left bend to 1.
sensor bendFar "Bend 60 m ahead" in -0.05 1/m .. 0.05 1/m = track.curvatureAhead(distance: 60 m)

// How much tire slide is fine before it costs points. 0 is full grip, 1 is a full slide.
let slipLimit = 0.3

// Runs for every car, 30 times per second.
each tick {
  // Steer and press the pedal as the brain says.
  drive(steer: brain.steer, pedal: brain.pedal)

  // The built-in rewards: a little for speed, a point per checkpoint, a bonus per lap.
  reward +0.002 * car.speed
  reward +1 when checkpoint.passed
  reward +10 when lap.completed
  // Sliding means the car asked the tires for more grip than they have.
  // A small penalty teaches it to brake before a corner instead of sliding through it.
  reward -0.05 when car.slip > slipLimit

  // Leaving the road or getting stuck ends the run.
  stop "crash" when car.offTrack
  stop "stalled" when car.noProgress > 3 s
}

// Runs once per generation and sets how the next brains are bred.
each generation {
  // Aim for 10 species. adaptive mutates structure more when there are too few species
  // and less when there are too many, which steers the count toward the target.
  speciate(target: 10, adaptive: true)
  // The best 20% of each species become parents.
  select(top: 20%)
  // Slightly more structural mutation than the default, since this brain has more inputs.
  breed(crossover: 0.75, mutate: { weights: 0.8, addConnection: 0.08, addNode: 0.04, toggle: 0.01 }, adaptive: true)
  // Never lose the best brain of a species.
  keepChampions()
  // Every 10 generations, race on a brand new random track so brains cannot memorize one road.
  if generation % 10 == 0 and generation > 0 {
    randomTrack(seed: generation)
  }
}
`;
