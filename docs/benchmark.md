# The Racing benchmark

The benchmark is a fixed exam for a trained brain. Training fitness depends on the script's own rewards, so two runs with different scripts cannot be compared by fitness. The benchmark ignores the script's rewards and drives every brain the same way, on roads no run ever trains on, and turns the result into a score from 0 to 100.

The code lives in `src/engine/bench`. Call `runBenchmark(config, genome)` with a run's config and a champion genome.

## The exam

There are five roads. Three are hand-built (Harbor, Switchback and Lakeside) and are not in the public track list, so no script can pick them with `useTrack`. Two are random roads made by `randomTrackSpec` from fixed seeds. Every road passes `checkTrack`, and a test proves the scripted driver laps each of them from every start.

Each road is driven three times: from the start line, from a third of the way round and from two thirds of the way round. Memorizing one opening does not help. Every episode lasts 60 seconds and uses the standard car.

During the exam the brain gets the inputs of its run's blueprint plus the custom sensors of its script, so it sees exactly what it learned with. Its outputs go straight to the car. Nothing is rewarded and nothing is stopped by the script: a car only stops when it hits the barrier or when time runs out. Changing a script's rewards therefore never changes a score, and a test checks this.

## Scoring

Each episode gets three numbers between 0 and 1.

Completion is the share of one lap the car drove. Hitting the barrier keeps 70% of it.

Speed compares the car's best lap with the scripted driver's best lap on the same course, so 100% means scripted driver pace. A car that never finishes a lap gets its average speed against par, scaled by how much of the lap it covered, so crashing early at full throttle earns little.

Smoothness is one minus the mean change of the steering command per tick, measured against 0.1 as fully jerky. It is scaled by the share of the lap driven, because a parked car has nothing to be smooth about.

The three starts of a road are averaged into that road's numbers, and the five roads into the radar. The fourth radar axis, generalization, is the completion on the weakest road. A brain that only learned one kind of road scores low there even if it is brilliant on the others.

The score is a weighted sum of the radar:

| Part | Weight |
| --- | --- |
| Completion | 40% |
| Speed | 30% |
| Smoothness | 15% |
| Generalization | 15% |

The result also lists raw metrics (laps, best lap time, mean distance, crash rate and steering change), a score per road, and the score per 100 parameters, which ties the benchmark to the model card.

## Versions

Scores only compare within one `BENCHMARK_VERSION` (in `src/engine/core/version.ts`). Changing a road, a start, a seed or anything in `scoring.ts` changes scores, so it must bump the version. A change to the simulation bumps `ENGINE_VERSION` instead. Both versions are stored in every result and in the reference file.

## Reference results

`public/references/racing.json` holds reference curves for the three Racing script presets: Beginner, Intermediate and Advanced. For each preset, `scripts/generate-references.ts` trains several seeds with 100 cars on the Oval, benchmarks the champion every 5 generations, and keeps the median and the 25% to 75% band at each of those generations. The Bench tab draws them next to a user's score.

The shipped file uses 12 seeds and 100 generations per preset, which takes about 11 minutes on two cores.

| Preset | Final median score |
| --- | --- |
| Beginner | 23.5 |
| Intermediate | 39.3 |
| Advanced | 30.2 |

The curves are worth a look on their own. Beginner peaks around generation 5 and then falls as it memorizes the Oval, a textbook picture of overfitting.

Advanced is meant to come out on top, but at this budget it does not. Its champions steer harder, crash more and score lower than Intermediate's on every part of the exam, including the random roads it trains on. Turning off its random tracks, its adaptive mutation or its slip penalty one at a time does not close the gap, and neither does training longer (400 generations scored lower than 150). Retuning the weights cannot fix it either, because Intermediate leads on every axis. Its bigger brain explains part of the gap: the same script with the standard brain scores a few points higher, though still below Intermediate. A likely reason is that curvature inputs let a brain memorize the shape of its current training road instead of learning to read any road with its rays. The reference test marks "Advanced beats Intermediate" as a known failure, so it gets noticed when a preset change makes it pass.

Regenerate the file with `npm run refs`. It uses two worker threads by default, and `npm run refs -- --workers 0` keeps it on one. A test fails when the file's versions do not match the current constants, so a version bump forces a regeneration. A nightly workflow, `.github/workflows/references.yml`, also regenerates it and commits any change to the `references/update` branch for review.
