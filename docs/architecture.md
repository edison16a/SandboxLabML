# Architecture

SandboxLabML trains NEAT neural networks in the browser and draws them in 3D. The rule that shapes the code is **simulate lean, render rich**: simulations never know they are being drawn, and renderers only read snapshots. Quality settings, cameras and overlays can change freely without changing a single training result.

Both labs, Driving and Navigation, are plugins of one generic episode pipeline. The sections below describe the layers and threads, how an environment plugs in, then what each lab adds on top.

## Layers

| Folder | What lives there | May import |
| --- | --- | --- |
| `src/engine/` | Pure TypeScript: NEAT, the env registry and episode contract, the Driving and Navigation simulations, the SBL script language, blueprints, benchmarks, lessons, the training loop and the landing hero's loops. No DOM. | Only itself |
| `src/workers/` | Web Workers that wrap the engine: a coordinator, a pool of sim workers and a replay worker, plus the main thread client. | `engine` |
| `src/render/` | React Three Fiber scenes: the city and the SUV, the courses and runners, and the hero stage. Reads snapshots, never simulates. | `engine` types, `features` stores |
| `src/storage/` | The only IndexedDB code (Dexie): runs, generations, checkpoints, scripts, blueprints, drawn courses, lesson progress. | `engine` |
| `src/features/` | Pages and panels: the two labs and their Sandboxes, charts, network graph, model card, runs, landing, walkthroughs. | everything above |
| `src/studio/` | Script Studio: code editor, block editor, reference, test runs, lessons and the benchmark tab. | everything above |
| `src/ui/` | Small design system on Radix primitives, plus the logo, the GitHub button and the walkthrough engine. | nothing app specific |
| `app/` | Next.js routes. Thin wrappers around `features`. The routes of two retired labs redirect to the new ones in `next.config.ts`. | `features` |

## Threads

| Thread | Job | Talks to |
| --- | --- | --- |
| Main | UI, charts and the 3D renderer. No simulation in the labs. | Coordinator through Comlink. Receives snapshot streams |
| Coordinator worker | NEAT selection, generations, curriculum steps and checkpoints | Sim workers through ports the main thread hands it |
| Sim workers (cores minus 2, 1 to 8) | Headless batches, plus the live generation at watch speeds | Coordinator. Sim worker 0 streams the live generation to the main thread |
| Replay worker | Ghosts of past champions, the Sandbox and background benchmarks | Main thread, with its own snapshot stream |
| Test run worker | The Studio's test runs and lesson previews (`src/studio/panels/testrun/testRun.worker.ts`) | The Studio |

* Commands and results go through Comlink. Snapshots never do: each stream (`population` and `ghosts`) has its own `MessagePort`, and buffers cycle through a ring of three so the main thread never queues more than two frames.
* Watch speeds (1x, 2x and 4x) run the whole generation live in one sim worker, paced to real time. Turbo and Max split the population across all sim workers and run flat out. Turbo keeps the viewport busy with ghosts. Max stops drawing and holds the viewport so every core trains.
* At Turbo and Max several generations can finish each second. The lab hands records to its store at most twice a second, so the charts repaint in step with the eye instead of with the trainer.
* The replay worker re-simulates stored champions. It is separate so watching never slows training down.

## The episode pipeline

Both labs share one shape: a population of independent agents in one shared world. Every agent has its own brain, agents never touch each other, and a generation runs every brain once (over one or more trips or courses). One pipeline trains, replays, stores, benchmarks and teaches every env of that shape. An env plugs in with its own modules and one entry per layer:

| Layer | What the env provides | The one entry |
| --- | --- | --- |
| Engine | An `EpisodeEnvInfo` and an `EpisodeEnvModule` (`src/engine/env/episode.ts`), and an env class that implements `EpisodeEnv` | Add the id to `EnvId` in `src/engine/env/types.ts` and the info to the map in `src/engine/env/registry.ts` |
| Scripts | A registry slice (`src/engine/script/registry/<env>/`) and its preset scripts | A row in `SCRIPT_ENV_TABLE` (`src/engine/script/envs.ts`) |
| Lessons | Lesson JSON under `content/lessons/<env>/` and the module's `lessons` hooks | The imports in `src/engine/lessons/catalog.ts`, and optionally a preview drawer row in `src/studio/panels/learn/preview/episode/drawers.ts` |
| Shell | A route under `app/lab/` and the lab component | A row in `LABS` (`src/features/shell/labs.ts`) |
| Brains | A sensor form that composes `BrainStartFields` | A row in `BLUEPRINT_FORMS` (`src/features/blueprints/forms.ts`) |

Everything else finds the env through those entries: the trainer, the sim and replay workers, run storage and export, the Runs page, the benchmark, and the Studio's checker, palette, reference, test run and lessons. A consistency test checks that every registered env has a script row, a lab row and a page.

**The env class** is stepped in lockstep at the module's `tickHz` (30 for both labs). `reset(brains, seeds, slots)` starts an episode, `step()` advances every running agent, `done` says when all stopped and `results()` gives one result per agent with at least `fitness`, `time` and `stopReason`. `leaderIndex`, `lastObservation`, `writeOutputs` and `writeRays` feed the camera and the inputs overlay. Steps, snapshots and world writes allocate nothing.

**The info and the module** are the two halves of an env. The info is the light half that any page may read: names, the snapshot layout, `metrics`, preset brains, the input schema, the `bench` (whose `run` loads its exam on first use) and what lessons measure. Its `load()` is a dynamic import of the module, which adds the simulation, so the Runs page and the Studio never ship an env's engine and a lab ships only its own. Workers, labs and headless code call `loadEpisodeModule(env)` before they simulate. `requireEpisodeModule(env)` then answers synchronously. A test keeps the registry's static graph free of every `module.ts`.

* Brains: `blueprints` (preset brains, simplest first), `inputCount`, `inputSchema` (labels and scales, script sensors last), `outputs`, `validateInputs` and `physicsHash`.
* Episodes: `createSetup` turns the run and the content into a plain setup a worker can rebuild (it carries `scriptSource`), and `createEnv(setup, host, seed)` builds the episode. `host.createController` returns the script's controller, or null for a run without a script, when the env uses its built in reward.
* Records: `championFields` gives the champion's `{ metrics }`, `generationMetrics` gives stats over the whole population, and `metrics` declares both with labels, units and formats, so the champion table, lesson checks and generation blocks (`ctx.metrics`) read them without knowing the env. The Progress tab charts every generation metric, and champion metrics marked `chart`. Run rows keep the best of every metric, and a run card shows the one marked `summary`.
* Optional hooks: `bench` (held out content, a score from 0 to 100 and radar axes, see [benchmark.md](benchmark.md)) and `lessons` (what a test run measures, the lesson brain and settings, a fixed test brain, and a `preview` hook whose `scene` gives the Studio's lesson preview the still parts of the world). The preview records the very episode a check runs: the agent's snapshot, the world block, its rays and its reward at every tick.

Each env has its own `engineVersion`, so changing one env never blocks replays or references of the other. A run of an env keeps its options under `settings` (`envSettings` reads them), and `createEpisodeRunConfig` builds a new run. Runs, scripts and files of an env a build does not have (`isEpisodeEnv` is false) stay stored but are left out of every list, and importing one says so in a sentence.

### Streams and the world block

A frame of either stream is `[count * stride agent floats][world floats]`. The agent part follows the env's `snapshot` layout (its `stride` and named `fields`). The world block holds state that is not per agent, written by `writeWorld` right after the agents: Driving's lights, cars and people, Navigation's clock and movers. The world follows only the setup and the tick, never the agents. Ghosts trained under different script versions run in separate envs, and a ghost frame takes the world block from the env with the largest tick, so they all drive through one world.

The stream's start message says how many world floats follow the agents and may carry the env's `scene()`: plain data about what the episode runs on (Navigation sends the course on screen), so the viewport draws exactly the scene the agents are in. Renderers read every field through named offsets (`SNAP`, `DRIVING_WORLD`, `WORLD_TIME` and the rest), never a raw index.

### Content and the curriculum

Content is what the population trains on now: for Driving the city, the level, the trip count and a trip seed, and for Navigation the level, the generation that seeds its courses, how many courses run and any named course. `initialContent` reads the run. After each generation, once the script's generation block has run, `nextContent` moves it on from the script's requests (`directives.env`, where each of the env's operators sets its own key with `setEnvDirective`) or from the env's own curriculum, and `contentHash` names it on every record (stored as `trackHash`, a field name older builds wrote). Anything that changes from one generation to the next belongs in the content, never in the setup, since ghosts and the Sandbox rebuild setups from the content alone. Both envs set `contentOnRecords`, so every record keeps the small content it ran on and a branch resumes exactly there.

Both curricula judge the best fifth of the population, since most of a generation are fresh mutants that crash or fall. They only move up, never down, and wait at least three generations on a level so none is skipped on one lucky start:

| Env | Levels | Moves up when |
| --- | --- | --- |
| Driving | 1 Empty streets, 2 Traffic lights, 3 Pedestrians, 4 Traffic, 5 Rush hour | the best fifth of the population by fitness arrived safely (no crash, no person hit, no red light run) on half of their trips, averaged over 3 generations |
| Navigation | 0 Straight run, 1 One block, 2 Block field, 3 Spikes, 4 Walls and gaps, 5 Movers, 6 Gauntlet | the best fifth of the population by fitness finished three quarters of their courses, averaged over 2 generations |

A script can take over from its generation block: `useLevel` fixes the level and `autoLevel` brings the curriculum back with a bar of its own, in both envs, while Driving adds `useCity` and `routesPerGeneration` and Navigation adds `useCourse` and `coursesPerGeneration`. The generation block reads the env's metrics through generation sensors (`metricSensor`).

### The lab

A lab wraps its page in `LabProvider` with its env, module, a store that extends `LabState`, an `EpisodeSession` and its last run key. The shared toolbar, run switcher, side panel and its tabs, inputs card, viewport controls, new run dialog bones (`NewRunShell`) and the bootstrap, schema, inspect, shortcut and quality hooks then work the same in both labs. The Model tab's "Grow this brain" opens the env's blueprint form and forks the latest checkpoint onto the new inputs by their schema keys (`forkRun`). The lab adds its viewport, HUD and Sandbox, and a session subclass adds its own store fields through the session's hooks (`beforeLoad`, `openedState`, `onContent`, `afterGhosts`, `ghostContent`, `ghostSetup`). A Sandbox that plays a shipped model sets the store's `sandboxBrain`, so the inputs and network panels show that model's brain rather than the run's.

A test only toy env (`src/engine/env/tests/toyEnv.ts`, with its script slice in `toyScript.ts`, registered through `registerEpisodeModule` and `registerScriptEnv`) runs the whole pipeline, scripts and lessons included, and is a small example of the contract.

## Determinism

Ghosts, the Sandbox and resumed runs work by re-simulating genomes, so results must repeat exactly:

* Every random choice goes through a seeded `Rng` (sfc32). Episode seeds are mixed from the run seed, the generation and the genome id. Ghosts use their own salt.
* Agents never share state, and the world ignores them, so a champion replayed alone matches its training run tick for tick. Tests check this for both envs, and `src/engine/training/goldenRuns.test.ts` pins the hashes of short Driving and Navigation runs so any change to their results shows.
* Weights are rounded to float32 when mutated, so the compact binary genome format (16 bytes per connection, 8 per neuron) round-trips exactly.
* The rules are frozen per run and hashed (`physicsHash`), and every run stores its env's engine version. On a mismatch the lab says the run's generations cannot be replayed, rather than drawing a wrong path.

## Drawing

* Settings, behind the gear at the top right, hold the frame rate (30, 60 or Max) and the quality (Low, Medium or High) for both labs, saved in localStorage. Until someone picks a quality, a discrete GPU gets High and an integrated or software one gets Medium. `?quality=` in a lab's address overrides the choice (`low`, `medium`, `high`, or `ultra` for screenshots), which the browser tests use.
* A viewport is live (animating), idle (drawing only when something changes) or held (drawing nothing new). Held is a lab training at Max.
* A live viewport under a 30 or 60 cap runs with `frameloop="never"` and `FramePacer` draws on the display frames closest to the cap. The Max frame rate draws on every display frame. Every viewport redraws right after it resizes, so dragging the divider next to the side panel never shows an empty canvas.
* Cameras never read an agent's pose directly. They follow their own smoothed state, so a stalled snapshot, a wobble or a hand over to a new leader turns into a short glide. The leader is sticky: in Driving another SUV must get 8 m further along the route to take the camera (`src/render/driving/frame/leader.ts`).
* The rest of the population draws in one instanced draw call, colored by species, and past champions replay beside it on an age ramp. Driving draws them as see through ghost SUVs, with a depth pass first that keeps only the nearest ghost surface per pixel, so a stack of them reads as one shape. Navigation draws a crowd of lower detail runners and fainter ghosts.

## Driving

The city is a street grid built from a spec (`src/engine/driving/city`): Midtown, Harbor, Old Town or a random grid from a seed. It has lanes joined into a lane graph, sidewalks, zebra crossings, a few slow streets and a signal at every crossing and T junction. Every signal runs the same plan with its own seeded offset: one axis gets green, then yellow, then a short all red, then the other axis. Left turns share the green and must yield.

* **Traffic** follows the lane graph with the intelligent driver model, stops for red and for yellow when it can, yields to people on crossings and to oncoming cars when turning left, and picks its turns at random. It never reacts to the learners, which is what lets a whole population share one city.
* **People** walk the sidewalks and cross with the walk signal. From the Traffic level on some cross late on the flashing hand, and at rush hour some cross mid block.
* **The SUV** is a kinematic bicycle model with a friction circle grip limit: braking and turning share the same grip. A brain has two outputs, `steer` and `pedal`.
* **Sensors** are chosen per brain (`DrivingInputConfig`): a lidar fan of 1 to 33 beams (optionally saying what each one hit), the lane (offset, heading error and how the road bends ahead), the route (next maneuver and distances), the light ahead and its stop line, the car ahead, the nearest person in the path, and speed. The Starter, Standard and Advanced brains have 17, 25 and 46 inputs.
* **A generation** drives three trips by default (`trips`), each its own `DrivingEnv` with its own city life. Every SUV drives the same trips and its fitness adds up over them. The built in reward pays progress along the route and a bonus for arriving, with costs for red lights, crashes, people hit, leaving the lane and speeding (`src/engine/driving/builtinReward.ts`).
* **The world block** has an 8 float header (time, counts, whether signals run, the level and the trip), then 6 floats per signal, 8 per car and 6 per person, at fixed offsets (`DRIVING_WORLD` in `src/engine/driving/snapshot.ts`).

The renderer (`src/render/driving`) builds the city, the SUV and the traffic in code. The followed SUV is the full build, with a sprung body driven by the simulation's real accelerations, steering wheels and lamps that follow the snapshot flags. Traffic draws one instanced call per body type, and people one instanced call with the walk cycle in the vertex shader. The cameras are chase (behind a gliding anchor, turning with the car per meter of road), orbit, corner (a fixed camera at the next junction on the route that pans to keep the car framed), top down and free.

The sensor overlay draws what the followed SUV senses and plans: its lidar beams with a dot where each one hits (cyan for curbs and walls, amber for cars, magenta for people), boxes round what it detected, the light it is reading and the line it means to stop at, the route ahead as a ribbon on the road, chevrons where it will be over the next few seconds, and the destination zone. The overlay runs the engine's own lidar on the drawn world, so every beam is one the brain really has.

The Driving Sandbox drives stored champions or the shipped trained model on any city, level and trip through the replay worker, and training never sees it. Up to 8 SUVs line up nose to tail on the first lane of the route. A destination clicked on the map replaces the seeded one. Training puts every SUV on the same spot, slot 0, so a lone champion replays its trip exactly.

## Navigation

A course is a room with a start line, a finish line and obstacles: crates, walls, spike pads and movers (crates that slide back and forth on a fixed period). `generateCourse(level, seed)` places a level's pieces at random with spacing rules and keeps the result only when a walkable path leads from the start to the finish. Every generation runs fresh courses (two by default), so brains learn to navigate rather than memorize a room. Named courses (`src/engine/navigation/course/presets.ts`) can be picked by a script with `useCourse`, except the two held out for the benchmark.

* **The runner** is a small round body with a top speed and a turn rate. It slides along walls, and speed it could not use is lost. Spikes end a run, a mover can crush it, and four seconds without getting closer to the finish ends it as stuck. Its outputs are `move` and `turn`.
* **The path hint** comes from a walking distance field over a grid of the room, worked out once per course by Dijkstra from the finish line. The same field gives progress for fitness, the hint input and the dotted trail the renderer draws.
* **Sensors** are rays round the runner (4 to 24, optionally telling walls, spikes and movers apart), the finish bearing and distance, the path hint, its own speed and the clock. The Starter, Standard and Advanced brains have 11, 42 and 53 inputs, and Advanced has no path hint.
* **The world block** is `[time, moverCount, x0, z0, x1, z1, ...]`. Movers are a pure function of the clock, but streaming their positions keeps renderers free of course logic.

The renderer (`src/render/navigation`) draws the room on a tiled floor inside a grey block city that fades into haze. The followed runner is the full character, which looks at a mover close by, falls on spikes and celebrates at the line. The rest of the population is one instanced crowd at lower detail whose legs swing at the cadence of each runner's real speed. The cameras are Follow (a drone behind and beside the best runner, on springs stepped in simulation time), Overview, Top down and Free.

The Navigation Sandbox plays runners outside training through the shared ghost replay: `setGhostScene('navigation', setup, ghosts)` with a setup of one course and one ghost per runner, each with its own start slot. The runners are copies of the run's stored champions, or a model shipped in `public/references/navigation.json`, up to 40 at once.

* Each scene the Sandbox sends records a lineup in the store: the course and every runner's seed and start slot. Until the replay streams that very course, the viewport stands the runners on those spots, so frames of any other course (an older scene, or training's ghosts) never show.
* The course is a level of the curriculum (generated from a seed the user can change), a named course, or one the user drew. A `CourseSpec` may place its start line and finish line (`start`, `finish`, clamped by `courseLines`).
* The course editor works on immutable specs through the rules in `src/engine/navigation/course/edit.ts`, so undo is a list of earlier specs. Pieces may not share floor (a mover's whole path counts), except walls meeting walls. It refuses a course with no way from the start to the finish (`noWayThrough` in `src/engine/navigation/navigator/wayThrough.ts`): the floor a mover never leaves counts as solid, and a course with movers must be finished by the scripted navigator from one of the exam's start spots. Drawn courses live in the `courses` table, cleaned by `sanitizeCourse` on every read.

## Landing hero

The first screen of the landing page plays both labs live and side by side around the page text, with real brains: a trained SUV drives the city on the left and a trained runner crosses its courses on the right, each with a card showing its network at work. Nothing in it is canned video.

* The server HTML holds the text and a poster: a still of both scenes captured from the real renderer (`npm run hero:poster`, WebP files in `public/hero/`). Wide windows take the 16:9 frames, windows no wider than 3:2 the 4:3 frames, and portrait windows a frame with the scenes stacked. It paints before any script runs, and three.js is not part of the page's first load.
* Once the page has loaded and gone idle, `heroMode` decides whether the device goes live. Reduced motion, Save-Data, no WebGL 2, a window under 1024 x 560 px (where the brain card has no room beside the text), a phone (a touch screen whose shorter side is under 768 px, however it is held), fewer than 4 cores or under 4 GB of memory keep the poster. Otherwise `HeroLive` loads as its own chunk.
* Each scene is a pure loop in `src/engine/hero`: the SUV drives the trips in `public/hero/driver.json` one after another (`npm run hero:driver`), and the runner crosses the courses in `public/hero/navigator.json` (`npm run hero:navigator`). Each episode starts from a fresh env and a fresh copy of the brain, exactly as it was checked when the file was made, so every pass round the loop is the same. Between episodes the frame holds, dips to the page color and comes back up while the next one starts (`cut.ts`).
* Both loops run on the main thread, stepped at 30 Hz from the canvas's frame loop, and a slow frame slows the scene rather than piling up ticks. The course only starts warming up once the city is on screen, so the two never compete for the first frames.
* One canvas draws both scenes (`src/render/hero/stage/`). `splitLayout` splits the hero (side by side when it is wide, stacked when it is tall) and puts each subject in the middle of the part of its pane the text panel leaves free. The cameras aim at their subject and a shifted lens moves it there. A pane stays transparent until its scene is warm, then fades in over its half of the poster.
* Everything stops while the hero is off screen or the tab is hidden. The quality follows Settings. When nobody picked one, the hero starts a step below the labs' default.

## Walkthrough

Each lab opens a guided tour the first time someone visits it. The engine lives in `src/ui/walkthrough/` and knows nothing about the labs. The steps live in `src/features/onboarding/`.

* A step names what it frames with a selector, almost always a `data-tour` attribute, so restyling a control never breaks the tour. A selector that matches several elements frames them all, and a `fallback` covers controls a narrow layout hides.
* One `requestAnimationFrame` loop in `useStage` measures the target each frame and springs the hole, its outline and the card toward it, writing straight to the DOM. React renders only when the step changes. Reduced motion snaps instead and fades.
* The dim layer is one SVG path drawn with the evenodd rule, so the hole is unpainted and the page under it stays live and clickable. `placeCard` puts the card beside the frame without covering it. Under 640 px it becomes a sheet along whichever edge hides less of the frame.
* A step can wait for the user to press the real control, like Train, and a step's `prepare` puts the lab in the state its words describe.
* Right or Enter goes on, Left goes back and Escape skips. The card is a non modal dialog, so lab shortcuts like Space still work from inside it.
* The localStorage keys `sandboxlab.tour.driving` and `sandboxlab.tour.navigation` hold `1` once a tour was finished or skipped. The browser tests set them to keep tours out of the way, and each lab's help menu replays its tour.

## Scripts

SBL scripts start with a header such as `script "My script" for driving v1`. They are parsed with error recovery, checked against one API registry (names, kinds, units and scopes) and compiled into closure trees. Nothing ever evaluates generated JavaScript, so an imported run cannot carry code that runs on open. Each env's slice in `src/engine/script/registry/<env>/` lists the sensors, actions and operators its scripts may name, with docs and examples the Studio shows. Generation operators like `speciate` and `breed` only fill a plan. The tested NEAT code does the work.

## Persistence

Runs, per generation champions and the newest three population checkpoints live in IndexedDB, next to the courses the user draws. Destructive actions keep the old run in Trash for seven days. A run exports to one JSON file with genomes in base64. The Model tab also downloads the champion brain alone as a readable `.model.json`: every neuron and link with its weight, the input and output names, an evaluation order, and the exact genome in base64. Hidden neurons use the run's activation and outputs use tanh, so the file is enough to run the brain in any language.

Generation records and checkpoints are written through one queue, in the order they happened, because IndexedDB keeps no order between stores. A run reopens from the newest checkpoint its stored history reaches without a gap. Later generations are dropped and come back exactly when training resumes.

The Dexie schema (`src/storage/db.ts`) is at version 5. The tables of two retired labs stay declared, since dropping one would need a new version and their rows harm nothing. Nothing writes them, and destroying an old run still frees its rows.
