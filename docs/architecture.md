# Architecture

SandboxLabML trains NEAT neural networks in the browser and draws them in 3D. The rule that shapes the code is **simulate lean, render rich**: simulations never know they are being drawn, and renderers only read snapshots. Quality settings and arena counts can change freely without changing a single training result.

## Layers

| Folder | What lives there | May import |
| --- | --- | --- |
| `src/engine/` | Pure TypeScript: NEAT, Racing and Hide and Seek simulations, the SBL script language, blueprints, benchmarks, lessons, training loops. No DOM. | Only itself |
| `src/workers/` | Web Workers that wrap the engine: a coordinator, a pool of sim workers and a replay worker, plus the main-thread client. | `engine` |
| `src/render/` | React Three Fiber scenes. Reads snapshots, never simulates. | `engine` types, `features` stores |
| `src/storage/` | The only IndexedDB code (Dexie): runs, generations, checkpoints, scripts, blueprints, saved Sandbox tracks, lesson progress. | `engine` |
| `src/features/` | Pages and panels: labs, charts, network graph, model card, runs, landing. | everything above |
| `src/studio/` | Script Studio: code editor, block editor, reference, test runs, lessons and the benchmark tab. | everything above |
| `src/ui/` | Small design system on Radix primitives, plus the logo and GitHub button. | nothing app specific |
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

## Determinism

Overlay generations and round replays work by re-simulating genomes, so results must repeat exactly:

* Every random choice goes through a seeded `Rng` (sfc32). Episode seeds are mixed from the run seed, generation and genome id or match index.
* Cars and matches never share state, so a champion replayed alone matches its training run tick for tick. A unit test checks this.
* Weights are rounded to float32 when mutated, so the compact binary genome format (16 bytes per connection, 8 per neuron) round-trips exactly.
* The physics config is frozen per run and hashed, and every run stores `ENGINE_VERSION`. A mismatch shows "cannot replay" instead of a wrong path.

## Racing

The car is a kinematic bicycle model with a friction circle: rate-limited steering that fades with speed, brake-by-wire deceleration, and understeer that scrubs speed when the tires run out of grip. The track is one data structure sampled every meter along a centripetal Catmull-Rom spline. Rays are cast against the edges through a uniform grid. The 3D road, kerbs, run-off and barriers are built from the same arrays, so what cars sense is exactly what is drawn.

The cars on screen are built in code from one design in `src/render/racing/car`. The body is a loft of creased cross sections, so each panel is smooth and the lines between panels stay sharp. The followed car is the full build, under 50,000 triangles, with clear coat paint over metallic flakes and woven carbon. The rest of the field shares a light build of about 5,000 triangles in one instanced draw call. Each of its vertices carries its own surface values, and only the paint takes the species color. Every texture is computed on load, so nothing is downloaded.

The Sandbox races stored champions on any track through the replay worker, and training never sees it. Extra cars line up on a staggered grid that follows the road behind the start line, 6 m apart, or closer on a road too short for a full grid. Slot 0 is the start line itself, where training puts every car, so a lone champion still replays its lap tick for tick.

## Hide and Seek Sandbox

The Sandbox plays trained champions outside training: up to eight hiders and eight seekers in a preset room or one the user draws. `SandboxMatch` (in `src/engine/hideseek/sandbox/`) builds its own Rapier world from any walls and boxes and runs the same movement, grab, lock, sensor ray and sight code as a training match, in the same tick order. Those systems take a `PlayState` and check teams through each agent's team index, which is how one code path serves both.

* Each player senses exactly its team's trained inputs. A brain learned against one opponent, so its opponent inputs follow the nearest opponent it can see, else the nearest one. Rays pass through teammates, so "agent on ray" still means an opponent.
* A hider counts as seen when any seeker sees it. Brain outputs drive players directly and nothing is rewarded, like the benchmark, so the Sandbox cannot change a training result.
* Its stream has its own port, because a frame's size follows the number of players and boxes. An 8 float header says how many of each follow; its first three fields match an arena snapshot, so the HUD reads either.
* The room editor works on immutable rooms through the rules in `roomEdit.ts`, so undo is a list of earlier rooms. Rooms the user saves live in their own IndexedDB table and belong to no run, so every model can play in every room.

## Scripts

SBL scripts are parsed with error recovery, checked against one API registry (names, kinds, units and scopes) and compiled into closure trees. Nothing ever evaluates generated JavaScript, so an imported run cannot carry code that runs on open. Generation operators like `speciate` and `breed` only fill a plan; the tested NEAT code does the work.

## Persistence

Runs, per-generation champions and the newest three population checkpoints live in IndexedDB, next to the Sandbox rooms the user draws. Destructive actions keep the old run in Trash for seven days. A run exports to one JSON file with genomes in base64.

Generation records and checkpoints are written through one queue, in the order they happened, because IndexedDB keeps no order between stores. A run reopens from the newest checkpoint its stored history reaches without a gap; later generations are dropped and come back exactly when training resumes.
