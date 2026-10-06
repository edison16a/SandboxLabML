# Benchmarks

A benchmark is a fixed exam for a trained model. Training fitness depends on the script's own rewards, so two runs with different scripts cannot be compared by fitness. The benchmark ignores the script's rewards, plays every model the same way and turns the result into a score from 0 to 100. It is a measuring stick, not a leaderboard: scores only compare within one environment and one benchmark version.

The code lives in `src/engine/bench`. Call `runBenchmark(config, model)` with a run's config and its champion: a genome for Racing, or `{ hider, seeker }` for Hide and Seek. Both return the same `BenchResult` shape, with a score, a radar of four axes, raw metrics, a breakdown into parts and the score per 100 parameters.

# The Racing benchmark

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
| Advanced | 90.5 |

The curves are worth a look on their own. Beginner peaks around generation 5 and then falls as it memorizes the Oval, a textbook picture of overfitting. Intermediate climbs further but also trains on the Oval only, so it plateaus well below what it could reach.

Advanced wins by training on a curriculum: it rotates through all five built-in circuits, eight generations each. The recipe was picked by experiment (4 seeds, 80 generations each, same exam):

| Variant | Median |
| --- | --- |
| Intermediate | 46 |
| Old Advanced: bigger brain, random roads, adaptive mutation, lookahead sensor | 32 |
| Intermediate with the Advanced brain | 30 |
| Intermediate with a random road every 5 generations | 33 |
| Intermediate rotating the built-in circuits | 78 |
| Rotation plus the slip penalty (the shipped Advanced) | 77 |

Random roads were too varied to learn from in 100 generations, and the bigger brain learned more slowly in the same time. Real circuits in rotation teach the brain to read the road with its rays instead of memorizing one shape. A related engine fix landed at the same time: when a script switches tracks, species stagnation now resets, since scores on a new road are not comparable with the old one.

Regenerate the file with `npm run refs -- --env racing` (plain `npm run refs` rebuilds both environments). It uses two worker threads by default, and `--workers 0` keeps it on one. A test fails when the file's versions do not match the current constants, so a version bump forces a regeneration. A nightly workflow, `.github/workflows/references.yml`, also regenerates it and commits any change to the `references/update` branch for review.

# The Hide and Seek benchmark

Hide and Seek has two roles, so the model being scored is a champion pair: the hider and seeker champions of one generation. Co-evolved fitness cannot show progress on its own, because both teams improve together. The benchmark plays the pair against fixed opponents instead: the reference champions of the three Hide and Seek presets, shipped in `public/references/hideseek.json`.

## The exam

A game is two matches from the same start. In the first the model's hider hides from the opponent's seeker. In the second the opponent's hider hides from the model's seeker. The same seed means the same spawn spots and the same box jitter in both, so whichever role a room favors, it favors both players equally.

The pair plays one game from each of 10 fixed starts in each of the three rooms (open, shelter and corridor) against each of the three reference champions. That is 90 games, or 180 matches. Start seeds come from a fixed salt (`examStarts` in `src/engine/bench/hideseek/exam.ts`) and never match a training seed.

Every match uses the standard physics and the standard 9 second prep phase, whatever rules or prep curriculum the run trained with. Each brain gets its own team's inputs plus its script's sensors, so brains of any shape can meet: a Starter seeker can play an Advanced hider. Brain outputs go straight to the agent. Nothing is rewarded and nothing is stopped, so a script's rewards never change a score, and a test checks this. The exam is deterministic: the same pair and the same reference file always give the same result.

## Scoring

A game is a win for the model when its hider stayed hidden longer than the opponent's hider did, by more than 5% of the seek phase (about one second). Closer games are draws and count half. This is the same as hidden share plus seen share above one, where hidden is the share of the seek phase the model's hider stayed out of sight and seen is the share its seeker had the other hider in sight.

The radar has four axes, each from 0 to 1:

| Axis | What it measures |
| --- | --- |
| Hiding | Mean hidden share of the model's hider against the reference seekers |
| Seeking | Mean seen share of the model's seeker against the reference hiders |
| Cover | Mean share of the seek phase the hider was out of range or behind a wall or box, so the seeker could not have seen it even by turning |
| Generalization | Win rate in the weakest room |

The score is a weighted sum:

| Part | Weight |
| --- | --- |
| Win rate over all 90 games | 40% |
| Hiding | 20% |
| Seeking | 20% |
| Cover | 10% |
| Generalization | 10% |

The win rate counts most because it is the one number that cancels out which role is easier. The result also lists the Elo-style rating, locks per match, a part per opponent (`vs:beginner` and so on) and a part per room (`room:open` and so on), and the score per 100 parameters, counting the weights of both brains.

## The rating

Each reference champion has a rating, fitted once when the reference file is built from a round robin between the three champions (their own exams), with the mean pinned at 1500. A model's rating is its performance rating against those fixed ratings: the rating whose expected points against the three champions equal the points it actually won. Both fits add one virtual draw per opponent, so a clean sweep gives a high but finite rating. A reference champion run through the exam gets its own rating back, and a test checks this.

## Versions

Scores only compare within one `HIDESEEK_BENCHMARK_VERSION` (in `src/engine/core/version.ts`). It is separate from the Racing version, so changing one exam never forces the other file to be rebuilt. Changing a room, the starts, the match count or anything in `src/engine/bench/hideseek/scoring.ts` changes scores, so it must bump the version. The reference champions are part of the exam too. Training is deterministic, so they only change when the engine, a Hide and Seek preset or the generator settings change. When a regenerated file ships different champions, bump the version in the same change.

## Reference results

`public/references/hideseek.json` holds a curve and a champion pair for each of the three Hide and Seek script presets. For each preset, `scripts/references/hideseek/generate.ts` trains several seeds with 50 per team, exactly as the lab would with that preset. Each tier's reference champion is the final pair of its middle seed, ranked by hidden plus seen share against the hand-written agents, so it is typical of the preset rather than its luckiest run. The three pairs are rated against each other, then every pair kept every 10 generations of every run plays the exam against them, and the median and the 25% to 75% band of those scores make the curves.

The shipped file uses 3 seeds of 40 generations per preset. Generating it took 40 minutes on three worker threads of a four core machine that was busy with other work (about 35 minutes when it is quiet):

    npm run refs -- --env hideseek --seeds 3 --generations 40 --workers 3

The generator's defaults are the nightly numbers instead: 5 seeds of 60 generations, about an hour on a four core runner and two hours on two cores. The nightly workflow runs them, so the first nightly file will differ from the shipped one, and its champions are different opponents (see Versions in this part).

| Preset | Final median score | Rating | Reference champion |
| --- | --- | --- | --- |
| Beginner | 53.9 | 1554 | seed 1, generation 40 |
| Intermediate | 51.4 | 1512 | seed 1, generation 40 |
| Advanced | 43.9 | 1435 | seed 3, generation 40 |

Median score at each checkpoint:

| Generation | 0 | 10 | 20 | 30 | 40 |
| --- | --- | --- | --- | --- | --- |
| Beginner | 35.8 | 63.6 | 64.7 | 61.4 | 53.9 |
| Intermediate | 38.2 | 48.3 | 55.5 | 60.3 | 51.4 |
| Advanced | 45.9 | 51.4 | 44.9 | 43.9 | 43.9 |

Single champions are noisy. A generation's champion pair is the one with the best co-evolved fitness, which depends on who it happened to meet, so one Beginner seed scored 62.8 at generation 30 and 37.3 at generation 40. The bands are there to show that spread, and a user's score is read against them at the same generation.

## What the references show

The presets were written as teaching tiers, and the benchmark finds that they are not ordered by playing strength at the budgets above. The exam is not the cause: hiders of all three tiers stay hidden about equally long, and the games are decided by the seekers. These single seed experiments (seed 1, win rate over the 90 exam games against the generation 40 champions of the three presets) show where the difference comes from:

| Run | Gen 10 | Gen 20 | Gen 30 | Gen 40 | Seen at gen 40 |
| --- | --- | --- | --- | --- | --- |
| Beginner | 0.69 | 0.78 | 0.76 | 0.60 | 0.44 |
| Intermediate | 0.62 | 0.59 | 0.63 | 0.49 | 0.31 |
| Advanced | 0.31 | 0.46 | 0.52 | 0.41 | 0.21 |
| Intermediate with the Starter brain | 0.83 | 0.58 | 0.80 | 0.49 | 0.29 |
| Advanced with v1 seeker rewards | 0.54 | 0.62 | 0.48 | 0.63 | 0.42 |

Two things hold the bigger presets back. The Standard and Advanced brains have 55 and 63 inputs, so evolution likely needs longer to find the one input that matters most for a seeker (opponent in sight). The same Intermediate rules on the 11 input Starter brain win far more games at generations 10 and 30, though not at 20 or 40, so this one is suggestive rather than settled. The clearer cause is the Advanced preset's cover rewards. They stop penalizing a seeker as soon as it has a line of sight to the hider, so turning to actually see the hider is worth half as much as under v1 rewards, and its seekers learn to look much more slowly. With v1 seeker rewards (minus one per second while not seeing the hider) the same preset sees the hider twice as often and edges past Beginner at generation 40.

Training longer does not change the picture. Single runs of 100 generations, scored against their own generation 100 champions, average a win rate of 0.65 for Beginner, 0.58 for Intermediate and 0.39 for Advanced over generations 50 to 100.

No weighting of the score's parts puts the tiers in order. Only hiding and cover favor the bigger presets at all (at generation 40: hidden 0.66, 0.70 and 0.68, cover 0.41, 0.53 and 0.52), and even there Intermediate edges out Advanced, so a score built on them alone would drop seeking, half of the game, for no gain. So the shipped file reports the order the presets really produce, and a test marks Beginner below Intermediate below Advanced as a known failure. Once the presets are retuned (a smaller or sparser seeker brain for Intermediate and Advanced, and v1 seeker rewards in Advanced are the two changes the data supports), regenerate the file and turn that test into a normal one.
