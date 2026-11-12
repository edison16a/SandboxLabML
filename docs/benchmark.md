# Benchmarks

A benchmark is a fixed exam for a trained model. Training fitness depends on the script's own rewards, so two runs with different scripts cannot be compared by fitness. The benchmark ignores the script's rewards, plays every model the same way on content training never sees, and turns the result into a score from 0 to 100. It is a measuring stick, not a leaderboard: scores only compare within one environment and one benchmark version.

## How an environment adds one

An env's benchmark is the `bench` field of its info (`EpisodeBench` in `src/engine/env/hooks.ts`): a version, the radar axes, a short hint and a one line summary for the chart, and `run(config, genome, opts)`. `run` loads the exam with a dynamic import on first use, so a page that only lists runs never ships it. Generic code calls `runBenchmark(config, genome)` from `src/engine/bench`, which returns a `BenchResult` (`src/engine/bench/types.ts`), or null when the env has no benchmark or the signal aborts.

| Field | What it holds |
| --- | --- |
| `score` | The score, 0 to 100 |
| `radar` | Four values from 0 to 1, keyed by the env's axes |
| `metrics` | Raw numbers, such as the share of trips that arrived |
| `parts` | One row per part of the exam, such as a level, with its own score |
| `scorePer100Params` | The score per 100 parameters, which ties the benchmark to the model card |
| `benchmarkVersion`, `engineVersion` | The versions it was measured under |

Both exams follow the same rules:

* The content is held out. Driving drives two cities that training only uses when a run or a script picks them. Navigation runs rooms made from a seed range training never draws from, plus two hand made rooms that no script can pick.
* The brain gets the inputs of its run's blueprint plus the custom sensors of its script, so it sees exactly what it learned with, and its outputs go straight to the agent. Nothing is rewarded and the script stops nothing, so changing a script's rewards never changes a score. A test in each env checks this.
* Every run is timed against a hand written expert that knows the world perfectly: the autopilot in Driving and the scripted navigator in Navigation. An efficiency of 1 means expert pace.
* The score is a weighted sum of four radar axes. Completion is how much of the way was covered, safety how cleanly, efficiency how fast, and generalization is the weakest part of the exam, so a brain that copes with one kind of street or room and not another scores low there.

| Env | Completion | Safety | Efficiency | Generalization |
| --- | --- | --- | --- | --- |
| Driving | 35% | 35% | 15% | 15% |
| Navigation | 40% | 20% | 20% | 20% |

In a lab the replay worker benchmarks every fifth generation's champion in the background (`BENCH_EVERY` in `src/features/lab/session/backgroundBench.ts`), one exam at a time and off the training threads. When an exam takes longer than five generations, only the newest champion waits for it and the ones in between are skipped. Results land on the generation record, in IndexedDB and on the run's summary. Each lab's Benchmark chart draws them next to the reference curves, and the Studio's Bench tab scores a run's champion on demand and compares it with the presets.

## Reference files

`public/references/driving.json` and `public/references/navigation.json` each hold, for the Beginner, Intermediate and Advanced preset scripts, a curve of the median and the middle half of several seeds' scores at every checkpoint, and a final score. Beside the curves sits one trained model per preset, which the Sandboxes play as their trained model, so a newcomer sees a skilled agent before training one. The Bench tab only draws curves from a file of the same benchmark version as the result, and with fewer than three seeds it shows the median alone.

`npm run refs` rebuilds both files (`scripts/generate-references.ts`). Pass `-- --env driving` or `-- --env navigation` for one env, and `--workers` for the number of worker threads (2 by default). Each env keeps its defaults and options in `scripts/references/<env>/generate.ts`, described in its section below. Training is seeded, so the same code makes the same file.

# The Driving benchmark

## The exam

The champion drives sixteen short trips alone, in Harbor and Old Town. Training uses Midtown by default and never picks those two unless a script asks for them, so the score says how well a brain drives streets it has not learned by heart. Each city gets two trips at every level from 2 to 5: one through a single turn and one straight along a street, each 160 to 320 m. Even rush hour uses these short trips, so a level is tested on its rules rather than on stamina. The trips, their world seeds and their time limits come from fixed seeds in `src/engine/bench/driving/exam.ts`.

The brain gets the inputs of its run's blueprint plus the custom sensors of its script, and its outputs go straight to the SUV. Nothing is rewarded and the script stops nothing. A trip ends the way the city ends it (arriving, a crash, a person hit, leaving the road, a wrong turn or the time limit) or after 15 seconds without progress that no light, car or person explains. Changing a script's rewards never changes a score, and a test checks this.

Every trip is timed against the autopilot, the hand written driver that knows the city perfectly. A test proves it arrives safely on all sixteen.

## Scoring

Each trip gets three numbers between 0 and 1.

Completion is the share of the trip covered: 1 on arrival, and at most 0.9 without one. Driving straight through the destination covers the whole route, but it is not arriving, so only arriving earns the last tenth.

Safety is that share again, times how cleanly it was driven: 0 for a crash, a person hit or leaving the road, half off for each red light run, a fifth off for each stop line overrun, and less for the share of the time spent speeding, on the wrong side or out of the lane. Scaling by the share covered means a brain that parks at the start is not called safe.

Efficiency is the autopilot's time over the brain's, times how clean the drive was, and only on an arrival. A trip that does not arrive has no pace to score. A brain that beats the autopilot by running a red light loses half its pace credit with half its safety, so cutting rules never pays.

The radar averages the three over all sixteen trips. The fourth axis, generalization (Both cities on the radar), is the score of the weaker city, so a brain that copes with one street layout and not the other scores low there. The score is a weighted sum of the radar:

| Part | Weight |
| --- | --- |
| Completion | 35% |
| Safety | 35% |
| Efficiency | 15% |
| Generalization | 15% |

The result also lists, per level, the share of trips that arrived and arrived safely, and the score per 100 parameters.

In the lab the exam runs in the background on every fifth generation's champion, one exam at a time. The exam takes longer than five generations of training under Max, so while one runs only the newest champion waits for it, and the ones in between are never scored. The Benchmark chart breaks its line across those gaps.

## Versions and references

Scores only compare within one `DRIVING_BENCHMARK_VERSION` (in `src/engine/driving/version.ts`). Changing a trip, a seed or anything in `src/engine/bench/driving/scoring.ts` must bump it. A change to the simulation bumps `DRIVING_ENGINE_VERSION` instead. Both are stored in every result and in the reference file.

`public/references/driving.json` holds a curve per preset and, beside it, one trained model per preset that the Sandbox can drive ("Try a trained model"). `scripts/references/driving/generate.ts` trains several seeds per preset on the settings a new run uses (Midtown, the automatic curriculum from level 1, three trips) and benchmarks the champion every 10 generations. A preset's final score is the median of every seed's scores at the last two checkpoints, because the curriculum keeps moving the level under the champion. The curves in the Bench panel and the Benchmark chart are the median and the middle half of the seeds at each checkpoint.

    npm run refs -- --env driving --workers 3

The defaults are 6 seeds of 500 generations with 100 SUVs. A run climbs slowly, since the curriculum only moves on once the champions it kept arrive safely on trips they were not picked on, so 500 generations is what it takes for a run that climbs to spend a long stretch at traffic and rush hour. `--dump file` keeps every run, with its checkpoints and every champion of its second half, and writes it again as each run finishes, seed by seed. `--from-dump a.json,b.json` builds the reference file from one or more dumps without training, so seeds trained in separate batches make one file and a change to the pick needs no retrain.

### The shipped run

The shipped file uses the defaults: 6 seeds of 500 generations per preset, 18 runs. They trained in 2 hours on three worker threads, each run taking 5 to 32 minutes. Runs that climb further take longer, since busier streets cost more to simulate and better drivers stay on the road for the whole trip: a generation at rush hour takes about eight times as long as one at traffic lights. Picking the models took another 15 minutes on one thread.

| Preset | Final score | Middle half at generation 500 | Level at generation 500 |
| --- | --- | --- | --- |
| Beginner | 34.2 | 27.9 to 37.6 | 2 for all six seeds |
| Intermediate | 59.6 | 58.0 to 70.4 | 3 for one seed, 5 for five |
| Advanced | 66.3 | 61.1 to 71.0 | 3 for one seed, 4 for four, 5 for one |

A run climbs slowly, and the curves show that pace. Intermediate and Advanced train the same until pedestrians (they only differ from level 3 on), and reach level 3 between generations 90 and 200. Intermediate reaches traffic between 130 and 250, and five of its six seeds reach rush hour, between 280 and 490. Advanced adds two costs near people and cars and a random city every other generation, so its champions take longer to pass the bar past pedestrians: it reaches traffic between 170 and 410, and one seed reached rush hour, at 360. Two runs, one of each, stopped arriving at traffic and stepped back down to pedestrians, as the curriculum does after 60 generations with almost no safe arrivals.

A final score in the 60s is a champion that arrives safely on about 70% of the exam's level 2 trips, on half of its pedestrian trips and on about 40% at traffic and rush hour, where a crash or a person hit ends about a third of its trips. Advanced ends highest even though it climbs more slowly than Intermediate: the exam drives two cities training never uses, and Advanced is the preset that trains in more than one city. The swing from one checkpoint to the next is still large: one Advanced seed fell from 62 to 44 in its last ten generations at traffic.

Beginner never leaves traffic lights. Its script punishes nothing but leaving the road, so its champions run red lights, and the curriculum only moves on once the kept champions arrive safely, which a trip with a red light run is not. All six seeds sat at level 2 from generation 50 at the latest to the end. In the two seeds whose every generation was logged, the kept champions arrived safely on about one trip in six, and never on half over five generations running, which is the bar. So the preset never meets the cross traffic its own comment counts on to teach red lights. Its final champions arrive on 81% of the exam's level 2 trips but safely on 48%, and crash on most trips at traffic and rush hour. The flat Beginner curve is what a new run on that preset does now.

### The trained models

A champion wins its generation on one score over three trips, often a lucky one, so it is not always a good Sandbox driver. The average Intermediate or Advanced champion of the second half of training arrives safely on about two thirds of its level 2 Sandbox trips and on two in five at traffic, and the average Beginner champion on almost none, since it runs red lights. So the shipped model is picked by how it drives where a visitor watches it, in `scripts/references/driving/pick.ts` and `sandboxTrips.ts`:

1. Every champion of the second half of every seed's training (generations 250 to 500, 1506 per preset) drives a quick screen during training: 4 Sandbox trips at each of levels 2 to 5, played the way the Sandbox replays the model, three copies lined up nose to tail in Midtown with the built-in rules.
2. The 16 best screened champions, plus the 8 that screen best at traffic and rush hour, drive 25 fresh trips per level. The best three drive 25 more.
3. The best weighted safe share over those 50 trips per level is the pick. Level 2 counts 40%, level 3 15%, level 4 35% and rush hour 10%. Every newcomer's Sandbox opens on level 2. A trained run opens on the level its training reached, and runs that climb spend longer at traffic than at any other level past 2.
4. Its reliability is then measured on 60 more trips per level that no step above saw. A safe trip arrives without a crash, a person hit or a red light run.
5. The model the file already holds drives the same 60 trips, and whichever has the better weighted share ships (`keep.ts`). A kept model is copied unchanged, so a rerun on the same engine writes the same file. `--replace-models` ships the new picks regardless.

| Preset | Model | Its benchmark | Safe, level 2 | Level 3 | Traffic | Rush hour |
| --- | --- | --- | --- | --- | --- | --- |
| Beginner | seed 4, generation 146, kept from the previous file | 72.7 | 79% | 71% | 67% | 56% |
| Intermediate | seed 5, generation 419 | 70.2 | 97% | 89% | 77% | 67% |
| Advanced | seed 4, generation 285 | 77.9 | 77% | 79% | 72% | 63% |

The shares are per SUV on the 60 unseen trips, three copies each. The models stand above their presets' final scores because they are the best drivers of six seeds, not typical ones.

Against the models shipped before, on the same trips, the new Intermediate pick is safer at every level, with a weighted share of 86% against 74%. The new Advanced pick trades some of level 2 for the busy levels (77% against 87% at level 2, 72% against 60% at traffic) and comes out ahead by a point, 74% against 73%. On 200 trips per level it leads by three, 78% against 75%, with 82% against 87% at level 2. The new Beginner pick, from runs that never left level 2, is safe on 85% of level 2 trips and on none past it, a weighted 34% against 71%, so the Beginner model trained under the earlier curriculum ships again.

A new run uses the Standard brain, so its Sandbox drives the better scoring of the two models with standard inputs, now the Advanced one. A run on the Starter brain gets the Beginner model, and a run on the Advanced brain, whose inputs no model shares, gets the best scoring model of all, also the Advanced one. A test drives three copies of the model a new run picks on the first twenty of the unseen level 2 trips and asks for safe arrivals on at least 70% of them.

# The Navigation benchmark

## The exam

The exam has 14 rooms, all from levels 1 to 6. Each level has two rooms made by the level generator from fixed seeds in a seed domain that training never draws from, so no run ever trains on them. Two hand made rooms join them: Switchback (level 4) and Clockwork (level 5), the named courses marked held out, which no script can pick with `useCourse` and the curriculum never generates.

Every room is run three times, from three spots of the start grid: the middle of the front row, far left in the front row, and right of the middle one row back. The runner is alone each time. It gets the inputs of its run's blueprint plus the sensors of its script, and its outputs go straight to its legs. Nothing is rewarded, and only the room's own rules end a run: the finish line, spikes, a mover, the clock, or four seconds without new ground. A script's rewards and stop rules never change a score, and a test checks this.

The code is in `src/engine/bench/navigation`: `exam.ts` builds the rooms and par, `walk.ts` runs one brain, `scoring.ts` holds the weights and `runner.ts` puts them together. The whole exam takes well under a tenth of a second for a trained brain.

## Scoring

Each run gets up to three numbers between 0 and 1.

Completion is the share of the walk covered at the runner's best point, measured along the shortest path round the obstacles. Crossing the line is 1.

Safety counts only in rooms with spikes or movers. It keeps the completion of a runner that stayed alive and gives 0 to one that died. A runner that never left the start is not safe, it is nothing, so it scores 0 here too.

Efficiency compares a finish with the scripted navigator's time from the same spot, so 1 means navigator pace. A run without a finish gets 0.

The runs of a level are averaged into that level's numbers, and all runs into the radar. The fourth axis, generalization, is the completion on the weakest level. A brain that only learned open floors scores low there even if it flies through them.

| Part | Weight |
| --- | --- |
| Completion | 40% |
| Safety | 20% |
| Efficiency | 20% |
| Generalization | 20% |

The result also lists raw metrics (finish rate, death rate, mean progress and mean finish time) and a score per level. The fixed lesson test brain, which simply turns toward the path hint, scores about 84. A still brain scores 0.

## Versions

Scores only compare within one `NAVIGATION_BENCHMARK_VERSION` (in `src/engine/bench/navigation/axes.ts`). Changing a room, a seed, a start spot or anything in `scoring.ts` changes scores, so it must bump that version. A change to the simulation bumps `NAVIGATION_ENGINE_VERSION`.

## Reference results

`public/references/navigation.json` holds a curve per preset and one trained model per preset, which the Sandbox plays under Trained model, so a newcomer sees a skilled runner without training one. `scripts/references/navigation/generate.ts` trains each preset through the same code the sim workers run, with 100 runners on the default curriculum, benchmarks the champion every 5 generations, and pools the last three checkpoints of every seed into the final score.

    npm run refs -- --env navigation --workers 2

The defaults are 8 seeds of 60 generations with 100 runners. `--dump file` keeps every run with its champions, and `--from-dump a.json,b.json` builds the file again from dumps without training.

### The shipped run

The shipped file uses the defaults: 8 seeds of 60 generations per preset, 24 runs. They trained in 6 minutes on two worker threads, 17 to 37 seconds a run. Advanced runs take the longest, since from the spikes on they run three courses a generation. The pick took 7 more minutes on one thread. Every seed of every preset reached the Gauntlet (level 6).

| Preset | Final score | Middle half at generation 60 |
| --- | --- | --- |
| Beginner | 80.5 | 77.3 to 83.2 |
| Intermediate | 88.6 | 80.7 to 89.5 |
| Advanced | 93.5 | 93.3 to 95.5 |

The score is mostly how often a runner finishes and how fast. A Beginner champion near 80 finishes over 90% of the exam's runs but at about half the scripted navigator's pace. Intermediate champions move at nearly the navigator's pace and die a little more often. Advanced champions finish 95% or more at about 90% of the navigator's pace. Movers (level 5) are the weakest level for every preset. The presets rank Beginner, Intermediate, Advanced, as in the preset experiments below.

### The trained models

The pick lives in `scripts/references/navigation/pick.ts` and `sandboxCourses.ts`. Every distinct champion from the second half of every seed's training (generations 30 to 60) runs the courses a visitor meets in the Sandbox, eight copies at a time from the front of the start grid, as the Sandbox lines up a model: the first layout of every level, three more layouts of each level and the named courses. The Sandbox opens on the first layout of level 1 for a new run and of the training level for a trained one, so level 1 counts the most, then the other first layouts. The twelve best finishers take the benchmark, and the best finisher that scores at least its preset's pooled final score ships, so a model never scores below what its preset typically reaches. Fresh layouts of levels 1 to 6 that the pick never saw give the reliability below.

| Preset | Model | Its benchmark | First layouts finished, levels 0 to 6 | Fresh layouts finished |
| --- | --- | --- | --- | --- |
| Beginner | seed 1, generation 54 | 88.5 | all eight copies on every level | 92% |
| Intermediate | seed 4, generation 53 | 92.4 | all eight copies on every level | 94% |
| Advanced | seed 4, generation 31 | 99.0 | all eight on every level but Movers, where seven of eight finish | 96% |

The Sandbox opens on the Advanced model.

## What the presets show

The brain matters more than the rewards. Four seeds of 60 generations each, pooled over the last three checkpoints:

| Rewards | Brain | Pooled score |
| --- | --- | --- |
| Beginner | Starter | 80 |
| Intermediate | Starter | 88 |
| Advanced | Starter | 94 |
| Intermediate | Standard | 71 |
| Advanced | Standard | 72 |
| Advanced without the extra courses | Standard | 74 |
| Advanced | Advanced (no path hint) | 39 |

The Starter brain has 11 inputs. The Standard brain sees more (hit types, its speed and the clock) but has 42 inputs, so evolution needs longer to tune it. The Advanced brain has no path hint and mostly stays stuck behind walls in 60 generations. All three presets therefore use the Starter brain, and on it they rank Beginner, Intermediate, Advanced. New runs in the lab start on the Starter brain too, so a first run climbs along the reference curves.
