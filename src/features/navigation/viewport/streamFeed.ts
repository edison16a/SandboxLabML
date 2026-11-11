import { NAV_RUNNING } from '@/engine/navigation/agent';
import type { Course } from '@/engine/navigation/course/build';
import type { CourseCache } from '@/engine/navigation/pipeline/courseCache';
import type { NavigationScene } from '@/engine/navigation/pipeline/courseSet';
import type { NavigationParams } from '@/engine/navigation/params';
import type { NavigationInputConfig } from '@/engine/navigation/sensors/inputConfig';
import { NAVIGATION_SNAPSHOT, navigationWorldSize, SNAP_STATUS } from '@/engine/navigation/snapshot';
import type { NavFeed } from '@/render/navigation/types';
import type { SnapshotStream } from '@/workers/client/snapshotStream';

const STRIDE = NAVIGATION_SNAPSHOT.stride;
const WORLD = navigationWorldSize();

/**
 * One snapshot stream (the live population or the ghost replay) as the
 * feed the Navigation viewport reads. Agents are read straight from the
 * stream's buffers; the world block that follows them is copied into
 * arrays of its own once per stream frame, so the renderer can index it
 * from 0. The course comes from the stream's start message, built once
 * per spec through the shared cache, so the population and the ghosts on
 * one course share one Course object.
 */
export class StreamFeed implements NavFeed {
  course: Course | null = null;
  curr: Float32Array | null = null;
  prev: Float32Array | null = null;
  world = new Float32Array(WORLD);
  prevWorld = new Float32Array(WORLD);
  count = 0;
  epoch = 0;
  timeScale = 1;
  inputs: NavigationInputConfig | null = null;
  follow: number | null = null;
  tags?: Int32Array;
  inspect: { index: number; obs: ArrayLike<number> } | null = null;
  /** The level of the course on screen, from the start message. */
  level = 0;
  private seenFrame: Float32Array | null = null;
  private seenScene: unknown = undefined;
  private running = false;

  /** True once the stream's episode sent its end message, until the next one starts. */
  ended = false;
  /** Stops listening to the stream. */
  readonly dispose: () => void;

  constructor(
    readonly stream: SnapshotStream,
    private readonly courses: CourseCache,
  ) {
    this.dispose = stream.on((msg) => {
      if (msg.kind === 'start') this.ended = false;
      else if (msg.kind === 'end') this.ended = true;
    });
  }

  alpha = (): number => this.stream.alpha();

  /** Catches up with the stream. Cheap when nothing changed, so it runs every frame. */
  sync(params: NavigationParams): void {
    const s = this.stream;
    if (s.scene !== this.seenScene) {
      this.seenScene = s.scene;
      const scene = s.scene as NavigationScene | null;
      this.course = scene?.spec ? this.courses.get(scene.spec, params) : null;
      this.level = scene?.level ?? 0;
    }
    const buffer = s.curr?.buffer ?? null;
    if (buffer !== this.seenFrame) {
      this.seenFrame = buffer;
      this.curr = buffer;
      this.prev = s.prev?.buffer ?? null;
      copyWorld(this.curr, s.count, this.world);
      copyWorld(this.prev, s.count, this.prevWorld);
      this.running = buffer !== null && anyRunning(buffer, s.count);
    }
    this.count = buffer ? s.count : 0;
    this.epoch = s.epoch;
    this.tags = s.tags;
    this.inspect = s.inspect;
  }

  /** True once the stream has a frame to draw. */
  get hasFrame(): boolean {
    return this.curr !== null && this.course !== null && this.count > 0;
  }

  /** True while someone in the latest frame is still running. */
  get anyRunning(): boolean {
    return this.running;
  }
}

function copyWorld(buffer: Float32Array | null, count: number, out: Float32Array): void {
  if (!buffer) return;
  const from = count * STRIDE;
  for (let k = 0; k < out.length; k++) out[k] = buffer[from + k] ?? 0;
}

function anyRunning(buffer: Float32Array, count: number): boolean {
  for (let i = 0; i < count; i++) if (buffer[i * STRIDE + SNAP_STATUS] === NAV_RUNNING) return true;
  return false;
}
