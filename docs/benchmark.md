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

Scores only compare within one `HIDESEEK_BENCHMARK_VERSION` (in `src/engine/core/version.ts`). It is separate from the Racing version, so changing one exam never forces the other file to be rebuilt. Changing a room, the starts, the match count or anything in `src/engine/bench/hideseek/scoring.ts` changes scores, so it must bump the version. The reference champions are part of the exam too. Training is deterministic, so they only change when the engine, a Hide and Seek preset or the generator settings change. When a regenerated file ships different champions, bump the version in the same change. A change to the Hide and Seek simulation bumps `HIDESEEK_ENGINE_VERSION`, which is separate from the Racing `ENGINE_VERSION`.

Version 4 came with ramps. Every exam room gained a ramp, both teams can lock, agents climb and vault, and the preset brains sense the nearest ramp, so the engine moved to `HIDESEEK_ENGINE_VERSION` 2. Champions trained before never met a ramp and lack the ramp inputs the presets now have, so they no longer stand for the presets. The reference file was regenerated for it. The lock number in a result counts only the model hider's locks, as it did before seekers could lock.

## Reference results

`public/references/hideseek.json` holds a curve and a champion pair for each of the three Hide and Seek script presets. For each preset, `scripts/references/hideseek/generate.ts` trains several seeds with 50 per team, exactly as the lab would with that preset. Each tier's reference champion is the final pair of its middle seed, ranked by hidden plus seen share against the hand-written agents, so it is typical of the preset rather than its luckiest run. The three pairs are rated against each other, then every pair kept every 10 generations of every run plays the exam against them, and the median and the 25% to 75% band of those scores make the curves.

The shipped file uses the generator's defaults, the same numbers the nightly workflow runs: 5 seeds of 60 generations per preset. It takes about 110 minutes on four worker threads:

    npm run refs -- --env hideseek --workers 4

| Preset | Final score | Rating | Reference champion |
| --- | --- | --- | --- |
| Beginner | 45.8 | 1550 | seed 2, generation 60 |
| Intermediate | 47.0 | 1496 | seed 2, generation 60 |
| Advanced | 45.8 | 1454 | seed 1, generation 60 |

Median score at each checkpoint:

| Generation | 0 | 10 | 20 | 30 | 40 | 50 | 60 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Beginner | 35.3 | 44.5 | 50.6 | 49.6 | 38.8 | 43.6 | 52.0 |
| Intermediate | 32.8 | 45.8 | 48.9 | 53.7 | 46.3 | 49.9 | 47.0 |
| Advanced | 34.6 | 44.5 | 43.2 | 43.2 | 52.1 | 45.7 | 44.9 |

Single champions are noisy. A generation's champion pair is the one with the best co-evolved fitness, which depends on who it happened to meet, so one run can swing 10 to 25 points between checkpoints. The bands are there to show that spread, and a user's score is read against them at the same generation. For the same reason a preset's final score is the median of every seed's scores at the last three checkpoints (generations 40, 50 and 60), so 15 scores instead of 5. Racing keeps the last checkpoint alone.

## What the references show

With ramps in every room, the three presets end within about a point of each other: Beginner 45.8, Intermediate 47.0 and Advanced 45.8. All three learn, from about 34 at generation 0 to about 46 by the end. What they no longer show is that the bigger presets' extra rewards and inputs buy a stronger pair in 60 generations. The small Beginner brain learns fastest, and its champion pair is the strongest of the three (it scores 56.0 against all of them).

Before ramps the tiers did end in order, only just: Beginner 47.0, Intermediate 50.7 and Advanced 55.7. Getting there took one change to the Advanced preset. It used to mirror the hiders' cover rewards for seekers, which stopped penalizing a seeker as soon as it had a line of sight to the hider. That made actually turning to see the hider worth half as much, and the first references ranked Advanced last, below Beginner. Single seed experiments against those references, at generation 40:

| Run | Win rate | Seen share |
| --- | --- | --- |
| Advanced with cover rewards for seekers | 0.41 | 0.21 |
| Advanced with v1 rewards for seekers | 0.63 | 0.40 |

Advanced seekers now keep the v1 rewards (plus one per second in sight, minus one per second out of sight after prep), and hiders keep the cover rewards. Starting the bigger brains with sparse wiring was tried too and made no clear difference.

Ramps took a second change. The Advanced preset used to spar with the scripted agents for its first 30 generations. Against the first version 4 references, its seekers found the reference hiders about half as often as Beginner's (seen share 0.21 against 0.43). Experiments against those references, pooling the scores of generations 40 to 60:

| Advanced variant | Seeds | Pooled score |
| --- | --- | --- |
| Sparring for 30 generations, plus a reward for each vault | 2 | 43.3 |
| Sparring for the first 10 generations only | 3 | 41.9 |
| Beginner style seeker rewards | 1 | 45.4 |
| The Standard brain | 1 | 45.4 |
| Hall of fame opponents from the start | 2 | 51.0 |

Advanced now plays the hall of fame from the start. That lifted it against the old champions, but once its own new champion joined the opponents the three presets came out level again.

A test checks that every preset learns: each ends at least 8 points above where its runs started. It used to check that the tiers rank in order. If a later change makes them rank cleanly again, bring that check back.
