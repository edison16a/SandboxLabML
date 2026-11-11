# Architecture

SandboxLabML trains NEAT neural networks in the browser and draws them in 3D. The rule that shapes the code is **simulate lean, render rich**: simulations never know they are being drawn, and renderers only read snapshots. Quality settings and arena counts can change freely without changing a single training result.

## Layers

| Folder | What lives there | May import |
| --- | --- | --- |
| `src/engine/` | Pure TypeScript: NEAT, Racing and Hide and Seek simulations, the SBL script language, blueprints, benchmarks, lessons, training loops. No DOM. | Only itself |
| `src/workers/` | Web Workers that wrap the engine: a coordinator, a pool of sim workers and a replay worker, plus the main-thread client. | `engine` |
| `src/render/` | React Three Fiber scenes. Reads snapshots, never simulates. | `engine` types, `features` stores |
| `src/storage/` | The only IndexedDB code (Dexie): runs, generations, checkpoints, scripts, blueprints, saved Sandbox tracks, lesson progress. | `engine` |
| `src/features/` | Pages and panels: labs, charts, network graph, model card, runs, landing, onboarding tours. | everything above |
| `src/studio/` | Script Studio: code editor, block editor, reference, test runs, lessons and the benchmark tab. | everything above |
| `src/ui/` | Small design system on Radix primitives, plus the logo, the GitHub button and the walkthrough engine. | nothing app specific |
| `app/` | Next.js routes. Thin wrappers around `features`. | `features` |

## Threads

| Thread | Job | Talks to |
| --- | --- | --- |
| Main | UI, charts and the 3D renderer. No simulation. | Coordinator through Comlink; receives snapshot streams |
| Coordinator worker | NEAT selection, generations, rounds and checkpoints | Sim workers through ports the main thread hands it |
| Sim workers (cores minus 2) | Headless batches, plus the live generation in watch mode | Coordinator; the live one streams snapshots to the main thread |
| Replay worker | Ghosts, round replays, Sandbox and telemetry | Main thread, with its own snapshot stream |

* Commands and results go through Comlink. Snapshots never do: each stream has its own `MessagePort`, and buffers cycle through a ring of three so the main thread never queues more than two frames.
* Watch speeds (1x to 4x) run a whole Racing generation live in one sim worker, paced to real time. Turbo and Max split the population across all sim workers and run flat out. Turbo keeps the viewport busy with ghosts or round replays; Max stops drawing and stops the replay so every core trains.
* At Turbo and Max several generations can finish each second. The lab hands records to its store at most twice a second, so the charts repaint in step with the eye instead of with the trainer.
* The replay worker re-simulates stored champions. It is separate so watching never slows training down.

## Drawing

* Settings, behind the gear at the top right, hold the frame rate (30, 60 or Max) and the quality (Low, Medium or High) for both labs, saved in localStorage. Until someone picks a quality, a discrete GPU gets High and an integrated or software one gets Medium. `?quality=` in a lab's address overrides the choice, which the browser tests use.
* A viewport is live (animating), idle (drawing only when something changes) or held (drawing nothing new). Held is the Racing lab while it trains at Max speed. Hide and Seek goes idle at Max speed instead, so it still redraws when the camera moves.
* A live viewport under a 30 or 60 cap runs with `frameloop="never"` and `FramePacer` draws on the display frames closest to the cap. The Max frame rate draws on every display frame.
* Every viewport redraws right after it resizes, so dragging the divider next to the side panel never shows an empty canvas.
* The Racing chase, orbit and trackside cameras never read the car's pose directly. They follow a gliding anchor (`src/render/racing/camera/chaseAnchor.ts`) that closes on the car in two spring stages with the car's smoothed velocity fed forward, so it sits on the car at a steady speed while a stalled snapshot, a wobble or a hand over to a new leader turns into a short glide. The leader itself is sticky: another car has to get 6 m ahead to take the camera (`leader.ts`). In the chase view the rest of the generation draws as see through ghosts, so the whole field stays in view.
* Hide and Seek's Close view is an action shot (`src/render/hideseek/camera/actionCam.ts`): it frames the players with a margin of floor from about 40 degrees, capped at 13 m so faces read, and keeps the hunting seeker (or the hider in prep) when the players are too far apart for one shot. It follows on springs, keeps a hand orbit and zoom, and frames the room beside or above the cards in the viewport's bottom left (`hudCover`). Overview keeps the whole room.
* When a wall hides a framed player for a moment, Close and the landing arena turn round it or climb over it to the nearest angle that sees every framed player (`WallDodge`). A player a wall still hides shows as a flat silhouette in its team color. Bodies mark the stencil where they are the nearest surface and the silhouette draws only where it is clear, so a character never shows its own limbs or another character through itself.
* Ghost cars draw a depth pass first, so each pixel shows only the nearest ghost surface, and they are satin shells with a rim of their own color. An older ghost fades out while a newer one drives through it.

## Determinism

Overlay generations and round replays work by re-simulating genomes, so results must repeat exactly:

* Every random choice goes through a seeded `Rng` (sfc32). Episode seeds are mixed from the run seed, generation and genome id or match index.
* Cars and matches never share state, so a champion replayed alone matches its training run tick for tick. A unit test checks this.
* Weights are rounded to float32 when mutated, so the compact binary genome format (16 bytes per connection, 8 per neuron) round-trips exactly.
* The physics config is frozen per run and hashed, and every run stores its env's engine version: the module's `engineVersion` (`ENGINE_VERSION` for Racing) or `HIDESEEK_ENGINE_VERSION` for Hide and Seek. They are separate, so a change to one game never blocks replays of the other. A mismatch shows "cannot replay" instead of a wrong path.

## Adding an environment

Racing, Driving and Navigation share one shape: a population of independent agents in one shared world. Every agent has its own brain, agents never touch each other, and a generation runs every brain once. One pipeline trains, replays, stores, benchmarks and teaches every env of that shape. Hide and Seek trains two teams in many arenas and keeps its own path.

An env plugs in with its own modules and one entry per layer:

| Layer | What the env provides | The one entry |
| --- | --- | --- |
| Engine | An `EpisodeEnvInfo` and an `EpisodeEnvModule` (`src/engine/env/episode.ts`), and an env class that implements `EpisodeEnv` | Add the id to `EnvId` in `src/engine/env/types.ts` and the info to the map in `src/engine/env/registry.ts` |
| Scripts | A registry slice (`src/engine/script/registry/<env>/`) and its preset scripts | A row in `SCRIPT_ENV_TABLE` (`src/engine/script/envs.ts`) |
| Lessons | Lesson JSON under `content/lessons/<env>/` and the module's `lessons` hooks | The imports in `src/engine/lessons/catalog.ts`, and optionally a preview drawer row in `src/studio/panels/learn/preview/episode/drawers.ts` |
| Shell | A route under `app/lab/` and the lab component | A row in `LABS` (`src/features/shell/labs.ts`) |
| Brains | A sensor form that composes `BrainStartFields` | A row in `BLUEPRINT_FORMS` (`src/features/blueprints/forms.ts`) |

Everything else finds the env through those entries: the trainer, the sim and replay workers, run storage and export, the Runs page, the benchmark, the Studio's checker, palette, reference, test run and lessons.

**The env class** is stepped in lockstep at the module's `tickHz`. `reset(brains, seeds, slots)` starts an episode, `step()` advances every running agent, `done` says when all stopped and `results()` gives one result per agent with at least `fitness`, `time` and `stopReason`. `writeSnapshot` writes `snapshot.stride` floats per agent, and `writeWorld` writes `worldFloats` floats of state that is not per agent (lights, traffic, movers) right after them in the same frame. The world follows only the setup and the tick, never the agents, since ghosts trained under different script versions run in separate envs and share the world of whichever one is furthest along. `leaderIndex`, `lastObservation`, `writeOutputs` and `writeRays` feed the camera and the inputs overlay. Steps, snapshots and world writes allocate nothing.

**The info and the module** describe the env to the pipeline. The info is the light half that any page may read: names, layouts, `metrics`, brains, the input schema, the `bench` (whose `run` loads its exam on first use) and what lessons measure. Keep its imports to layouts, schemas and blueprints. Its `load()` is a dynamic import of the module, which adds the simulation, so the Runs page and the Studio never ship an env's engine and a lab ships only its own. Workers, labs and headless code call `loadEpisodeModule(env)` before they simulate; `requireEpisodeModule(env)` then answers synchronously. A test keeps the registry's static graph free of every `module.ts`.

* Brains: `blueprints` (preset brains, simplest first), `inputCount`, `inputSchema` (labels and scales, script sensors last), `outputs`, `validateInputs` and `physicsHash`.
* Content: what the population trains on now, such as a track, a city and level, or a course level. `initialContent` reads the run, `nextContent` moves it on after each generation from the script's requests (`directives.env`, where each of the env's registry operators sets its own key with `setEnvDirective`, so two operators in one block both land; `metricSensor` gives a generation block one of the env's generation metrics) or the env's own curriculum, and `contentHash` names it on every record. Content is plain data and lives in checkpoints. Anything that changes from one generation to the next (a level, a route seed) belongs in the content, never in the setup, since ghosts and the Sandbox rebuild setups from the content alone. An env whose content changes in ways the hash cannot rebuild sets `contentOnRecords`: every record then keeps the content it ran on, and a branch resumes on it.
* Episodes: `createSetup` turns the run and the content into a plain setup a worker can rebuild (it carries `scriptSource`), and `createEnv(setup, host, seed)` builds the episode. `host.createController` returns the script's controller, or null for a run without a script, when the env uses its built in reward.
* Records: `championFields` gives the champion's numbers (newer envs return `{ metrics }`), `generationMetrics` gives stats over the whole population, and `metrics` declares both with labels, units and formats, so the champion table, lesson checks and generation blocks (`ctx.metrics`) read them without knowing the env. The Progress tab charts every generation metric, and champion metrics marked `chart`, one at a time with a picker. Run rows keep the best of every metric, and a run card shows the one marked `summary`, else the first champion metric.
* Optional hooks: `bench` (held out content, a score from 0 to 100 and radar axes), `telemetry` (distance, speed and brake per tick for the speed strip) and `lessons` (what a test run measures, the lesson brain and settings, a fixed test brain, and a `preview` hook whose `scene` gives the Studio's lesson preview the still parts of the world). The preview records the very episode a check runs: the agent's snapshot, the world block, its rays and its reward at every tick. Without a drawer row the Studio draws a top view of the trail, rays and facing from the snapshot's `x` and `y` (or `z`) fields, and a drawer row adds the scene on top with the shared helpers.

Each env has its own `engineVersion`, so changing one env never blocks replays or references of another. A run of an env keeps its options under `settings` (`envSettings` reads them), and `createEpisodeRunConfig` builds a new run from the module. Runs of an env a build does not have stay stored but are left out of every list.

**The lab** wraps its page in `LabProvider` with its env, module, a store that extends `LabState`, an `EpisodeSession` and its last run key. The shared toolbar, run switcher, side panel and its tabs, inputs card, viewport controls, new run dialog bones (`NewRunShell`) and the bootstrap, schema, inspect, shortcut and quality hooks then work as they do for Racing. The Model tab's "Grow this brain" opens the env's blueprint form and forks the latest checkpoint onto the new inputs by their schema keys (`forkRun`), so it works in every lab. The lab adds its viewport, HUD and anything only it has, and a session subclass adds its own store fields through the session's hooks. Ghosts of one scene share one content: by default the live one, so old champions race the new agents on the same course. A lab that wants a champion's own episode overrides `ghostContent` and returns what that record kept. `SidePanel` takes `progressExtra` for a lab's own panels under the metrics, or `progress`, `network`, `inputs` and `model` to replace a tab. A test only toy env (`src/engine/env/tests/toyEnv.ts`, with its script slice in `toyScript.ts`, registered through `registerEpisodeModule` and `registerScriptEnv`) runs the whole pipeline, scripts and lessons included, and is a small example of the contract. A consistency test checks that every registered env has a script row, a lab row and a page.

## Racing

The car is a kinematic bicycle model with a friction circle: rate-limited steering that fades with speed, brake-by-wire deceleration, and understeer that scrubs speed when the tires run out of grip. The track is one data structure sampled every meter along a centripetal Catmull-Rom spline. Rays are cast against the edges through a uniform grid. The 3D road, kerbs, run-off and barriers are built from the same arrays, so what cars sense is exactly what is drawn.

The cars on screen are built in code from one design in `src/render/racing/car`. The body is a loft of creased cross sections, so each panel is smooth and the lines between panels stay sharp. The followed car is the full build, under 50,000 triangles, with clear coat paint over metallic flakes and woven carbon. The rest of the field shares a light build of about 5,000 triangles in one instanced draw call. Each of its vertices carries its own surface values, and only the paint takes the species color. Every texture is computed on load, so nothing is downloaded.

The Sandbox races stored champions on any track through the replay worker, and training never sees it. Extra cars line up on a staggered grid that follows the road behind the start line, 6 m apart, or closer on a road too short for a full grid. Slot 0 is the start line itself, where training puts every car, so a lone champion still replays its lap tick for tick.

## Hide and Seek ramps and locks

Every room has five boxes in `BOX_KINDS` order: two cubes, two planks and a ramp. A ramp is a wedge 2.4 m long and 1.2 m wide whose top rises from the floor at its foot to 1.2 m at its lip. Its collider is the convex hull of that wedge, so a sight ray hits exactly the drawn slope. Its mass sits at the center of its footprint with a crate's inertia, so it is grabbed, carried, pushed and locked like any box. Every ramp and climbing number lives in `HideSeekPhysics` (`box.ramp`, and the `climb` group in `climbRules.ts` with the reason for each value), so it hashes into the rules.

* Both teams lock. An agent that is free to act, empty handed and on the floor locks the nearest free box in front of it, and only its own team can unlock it. The other team can neither unlock, grab nor push it. Seekers are frozen during prep, so they lock in the seek phase.
* An agent at the foot of a ramp that drives forward facing within 45 degrees of uphill mounts it (`agents/climb`). On the slope its collider touches nothing and the engine moves it: the move output sets its progress, it faces uphill, and its position comes from the ramp pose every tick, so a pushed or carried ramp takes it along. Backing past the foot steps off if there is room.
* At the lip it looks straight ahead for the first free landing spot within 3 m and jumps there in half a second, on an arc that clears the tallest thing it crosses. A jump that crosses a wall is a vault. With no free spot it waits at the lip, and nobody ever jumps the outer walls. An agent its controller stops finishes its jump, or steps off the foot as soon as there is room.
* Walls always block sight. Boxes block a sight line only when both ends are below 1 m, and the ramp an end stands on never blocks it. Boxes block at their slice at sight height, the high end of a ramp, so Rapier's sight lines, the 2D sensor rays and the cone drawings agree. Tests hold them to it.

## Snapshot layout

The engine writes snapshots and the renderer only reads them, through named offsets (`SNAPSHOT_PHASE`, `AGENT_ELEVATION`, `BOX_LOCK`, `SANDBOX_HIDERS` and the rest) and the helpers in `src/render/hideseek/frame/snapshotRead.ts` and `sandboxRead.ts`. Nothing reads a raw index.

| Stream | Header | Per agent | Per box |
| --- | --- | --- | --- |
| Arena, 34 floats | time, phase, hider seen, spare | x, z, yaw, flags, elevation | x, z, yaw, lock |
| Sandbox | time, phase, any hider seen, over, hiders, seekers, boxes, hiders seen | x, z, yaw, flags, elevation | x, z, yaw, bits |

Agent flags are `FLAG_HOLDING`, `FLAG_SEEING`, `FLAG_SEEN`, `FLAG_FROZEN`, `FLAG_CLIMBING` and `FLAG_AIRBORNE`. An arena box lock is 0 when free, 1 when the hiders own it and 2 when the seekers do, and the box kind follows from its index through `BOX_KINDS`. Sandbox boxes carry their kind and lock in bits: `BOX_LOCKED`, `BOX_PLANK`, `BOX_RAMP` and `BOX_SEEKER_LOCK`.

## Hide and Seek Sandbox

The Sandbox plays trained champions outside training: up to eight hiders and eight seekers in a preset room or one the user draws. `SandboxMatch` (in `src/engine/hideseek/sandbox/`) builds its own Rapier world from any walls and boxes and runs the same movement, grab, lock, sensor ray and sight code as a training match, in the same tick order. Those systems take a `PlayState` and check teams through each agent's team index, which is how one code path serves both.

* Each player senses exactly its team's trained inputs. A brain learned against one opponent, so its opponent inputs follow the nearest opponent it can see, else the nearest one. Rays pass through teammates, so "agent on ray" still means an opponent.
* A hider counts as seen when any seeker sees it. Brain outputs drive players directly and nothing is rewarded, like the benchmark, so the Sandbox cannot change a training result.
* Its stream has its own port, because a frame's size follows the number of players and boxes. An 8 float header says how many of each follow; its first three fields match an arena snapshot, so the HUD reads either.
* The room editor works on immutable rooms through the rules in `roomEdit.ts`, so undo is a list of earlier rooms. Rooms the user saves live in their own IndexedDB table and belong to no run, so every model can play in every room.
* The editor places cubes, planks and ramps. A ramp's yaw is its uphill direction, so it turns through all four quarter turns where a crate flips between two. Every 2D map (the editor board, the room thumbnails and the lesson preview) draws a ramp with chevrons toward its lip, from the shared geometry in `src/features/hideseek/components/maps/rampChevrons.ts`.

## Landing hero

The first screen of the landing page plays both labs live and side by side around the page text, with real brains: a trained car laps the Grand Prix on the left and the shipped Hide and Seek reference champions play two on two on the right. Nothing in it is canned video.

* The server HTML holds the text, on a flat blurred panel, and a poster: a still of both scenes captured from the real renderer (`npm run hero:poster`, WebP files in `public/hero/`). The wide frames show the scenes side by side, 4:3 frames do the same for squarer windows so the car is never cropped in half, and the portrait frame stacks them. It paints before any script runs, and three.js, the renderers and Rapier are not part of the page's first load.
* After the page has loaded and gone idle, `useHeroMode` decides whether the device goes live. Reduced motion, Save-Data, a window under 1024 x 560 px (where the brain card has no room beside the text, so the scene would play without the network that drives it), a phone (a touch screen whose shorter side is under 768 px, so a phone held sideways counts), no WebGL 2, fewer than 4 cores or under 4 GB of memory keep the poster. Otherwise `HeroLive` loads as its own chunk.
* `HeroLive` starts one replay worker, the labs' own, and loads both scenes into it: the car from `public/hero/racer.json` as a ghost (trained by `npm run hero:car`, checked against `ENGINE_VERSION` before it plays), then, once the car is on screen, the reference pair from `public/references/hideseek.json` as a Sandbox match. The worker imports Rapier only when that first match loads (see `loadRapier`), so the car never waits for the physics download, and the arena's warm up never competes with the car's.
* One canvas draws both scenes (`src/render/hero/stage/`). Each scene lives in an R3F portal with its own scene graph and camera, and `SplitRenderer` draws it into its pane with the viewport and scissor, setting that scene's tone curve and exposure first. `splitLayout` splits the hero (side by side when it is wide, stacked when it is tall) and puts each subject in the middle of the part of its pane the text panel leaves free; the cameras aim at their subject and a shifted lens moves it there. A pane stays transparent until its scene is warm, then fades in over its half of the poster. The hero has no effect composer, so the two scenes share one renderer cleanly; the racing pane gets the lab's High grade from a custom tone curve instead (`heroGrade`).
* Everything stops while the hero is off screen or the tab is hidden. The quality follows Settings; when nobody picked one, the hero starts a step below the labs' default.
* Before a scene first shows, `Prewarm` gets it ready without drawing: its logic steps until its data is in, then its shaders compile in the background through `KHR_parallel_shader_compile` (for its own tone curve) and its textures upload. Getting the second scene ready never stalls the first.
* Each scene has a brain card in its outer corner. A card runs the inputs the worker sends with each frame through a local copy of the network and repaints with `NetworkPainter`, which uses the graph's layout and colors but allocates nothing per paint. The arena card shows the hider's brain while hiders hide and the seeker's once seekers wake, and the arena camera follows that player at a size where faces read, keeping the shot on the room rather than the city and the player clear of the card.
* Leaving the page terminates the worker and R3F loses the WebGL context. A browser test checks both.

## Walkthrough

Each lab opens a guided tour the first time someone visits it. The engine lives in `src/ui/walkthrough/` and knows nothing about the labs; the steps live in `src/features/onboarding/`.

* A step names what it frames with a selector, almost always a `data-tour` attribute, so restyling a control never breaks the tour. A selector that matches several elements frames them all, and a `fallback` covers controls a narrow layout hides.
* One `requestAnimationFrame` loop in `useStage` measures the target each frame and springs the hole, its outline and the card toward it, writing straight to the DOM. The frame follows a target that moves or resizes, and React renders only when the step changes. Reduced motion snaps instead and fades.
* The dim layer is one SVG path drawn with the evenodd rule, so the hole is unpainted and the page under it stays live and clickable. `placeCard` puts the card beside the frame without covering it; under 640 px it becomes a sheet along whichever edge hides less of the frame.
* A step can wait for the user to press the real control, like Train. Its `done` check runs a few times a second, and once it passes the step shows its follow up text, often framing what the action set going. A step's `prepare` puts the lab in the state its words describe, like back to 1x before the steps that show one car drive.
* Right or Enter goes on, Left goes back and Escape skips. The page keeps the keys it needs: the arrows inside tab lists, toggle groups and sliders, Enter on a focused control, and Escape while a lab has something to back out of. The card is a non modal dialog, so lab shortcuts like Space still work from inside it.
* The localStorage keys `sandboxlab.tour.racing` and `sandboxlab.tour.hideseek` hold `1` once a tour was finished or skipped. The browser tests set them to keep tours out of the way, and each lab's help menu replays its tour.

## Scripts

SBL scripts are parsed with error recovery, checked against one API registry (names, kinds, units and scopes) and compiled into closure trees. Nothing ever evaluates generated JavaScript, so an imported run cannot carry code that runs on open. Generation operators like `speciate` and `breed` only fill a plan; the tested NEAT code does the work.

## Persistence

Runs, per-generation champions and the newest three population checkpoints live in IndexedDB, next to the Sandbox rooms the user draws. Destructive actions keep the old run in Trash for seven days. A run exports to one JSON file with genomes in base64. The Model tab also downloads the champion brain alone as a readable `.model.json`: every neuron and link with its weight, the input and output names, an evaluation order, and the exact genome in base64. Hidden neurons use the run's activation and outputs use tanh, so the file is enough to run the brain in any language.

Generation records and checkpoints are written through one queue, in the order they happened, because IndexedDB keeps no order between stores. A run reopens from the newest checkpoint its stored history reaches without a gap; later generations are dropped and come back exactly when training resumes.
