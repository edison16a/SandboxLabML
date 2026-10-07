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
* The physics config is frozen per run and hashed, and every run stores its engine version: `ENGINE_VERSION` for Racing, `HIDESEEK_ENGINE_VERSION` for Hide and Seek. They are separate, so a change to one game never blocks replays of the other. A mismatch shows "cannot replay" instead of a wrong path.

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

The first screen of the landing page plays both labs live behind the page text, with real brains: a trained car laps the Grand Prix and the shipped Hide and Seek reference champions play two on two. Nothing in it is canned video.

* The server HTML holds the text and a poster, a still of the racing scene captured from the real renderer (`npm run hero:poster`, WebP files in `public/hero/`). It paints before any script runs, and three.js, the renderers and Rapier are not part of the page's first load.
* After the page has loaded and gone idle, `useHeroMode` decides whether the device goes live. Reduced motion, Save-Data, a screen under 768 px, no WebGL 2, fewer than 4 cores or under 4 GB of memory keep the poster. Otherwise `HeroLive` loads as its own chunk.
* `HeroLive` starts one replay worker, the labs' own, and loads both scenes into it: the car from `public/hero/racer.json` as a ghost (trained by `npm run hero:car`, checked against `ENGINE_VERSION` before it plays), then, once the car is on screen, the reference pair from `public/references/hideseek.json` as a Sandbox match. The worker imports Rapier only when that first match loads (see `loadRapier`), so the car never waits for the physics download, and the arena's warm up never competes with the car's.
* Two canvases draw the scenes with the labs' renderers and crossfade every 13 s. A scene draws and its worker player runs only while it shows or fades; the other is held and paused. Both stop while the hero is off screen or the tab is hidden. The quality follows Settings; when nobody picked one, the hero starts a step below the labs' default.
* Before a scene first shows, `Prewarm` gets it ready without drawing: its logic steps until its data is in, then its shaders compile in the background through `KHR_parallel_shader_compile` and its textures upload. Getting the second scene ready never stalls the first.
* The brain card runs the inputs the worker sends with each frame through a local copy of the network and repaints with `NetworkPainter`, which uses the graph's layout and colors but allocates nothing per paint. During Hide and Seek it shows the hider's brain while hiders hide and the seeker's once seekers wake, and the camera follows that player.
* Leaving the page terminates the worker and R3F loses both WebGL contexts. A browser test checks both.

## Scripts

SBL scripts are parsed with error recovery, checked against one API registry (names, kinds, units and scopes) and compiled into closure trees. Nothing ever evaluates generated JavaScript, so an imported run cannot carry code that runs on open. Generation operators like `speciate` and `breed` only fill a plan; the tested NEAT code does the work.

## Persistence

Runs, per-generation champions and the newest three population checkpoints live in IndexedDB, next to the Sandbox rooms the user draws. Destructive actions keep the old run in Trash for seven days. A run exports to one JSON file with genomes in base64.

Generation records and checkpoints are written through one queue, in the order they happened, because IndexedDB keeps no order between stores. A run reopens from the newest checkpoint its stored history reaches without a gap; later generations are dropped and come back exactly when training resumes.
