/**
 * Intermediate driving preset. It must behave exactly like
 * builtinDrivingController, and a test compares the two SUV by SUV.
 */
export const DRIVING_INTERMEDIATE = `// Intermediate: the same rules the app uses when a run has no script.
script "Intermediate: built-in reward" for driving v1

// driving-standard sees nine lidar beams, its lane, its route, the light ahead,
// the car ahead, the nearest person in its path and its speed.
brain driving-standard

// Runs for every SUV, 30 times per second.
each tick {
  // Steer and press the pedal as the brain says.
  drive(steer: brain.steer, pedal: brain.pedal)

  // A little for every meter of new ground along the route.
  reward +0.02 * route.gain
  // Over the last 30 m, new ground pays more the slower it is covered.
  // That is the trail that leads to stopping in the destination zone.
  reward +0.1 * route.gain * (1 - min(1, car.speed / 8 m/s)) when route.remaining < 30 m
  // The big prize.
  reward +10 when car.arrived

  // Breaking a rule costs points. Hurting someone costs the most.
  reward -2 when rules.ranRedLight
  reward -0.3 when rules.overranStopLine
  reward -0.005 when rules.speeding
  reward -0.01 when rules.wrongWay
  reward -0.002 when rules.laneDeparture
  reward -0.01 when car.overCurb
  reward -2 when car.crashed
  reward -4 when car.hitPedestrian

  // A red light run ends the trip, like a crash, so every brain learns to wait.
  stop "redlight" when rules.ranRedLight
  // So do 8 seconds standing still with no light, car or person to wait for.
  stop "stuck" when car.noProgress > 8 s
}

// Runs once per generation and sets how the next brains are bred.
each generation {
  // Five species, the best fifth of each as parents, champions kept.
  // These match what the Driving brains use on their own.
  speciate(target: 5)
  select(top: 20%)
  // Mix two parents 75% of the time, then mutate: nudge weights often,
  // and now and then add a connection or a neuron so brains can grow.
  breed(crossover: 0.75, mutate: { weights: 0.8, addConnection: 0.05, addNode: 0.03, toggle: 0.01 })
  keepChampions()
}
`;
