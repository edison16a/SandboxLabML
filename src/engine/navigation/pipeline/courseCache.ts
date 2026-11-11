import { buildCourse, type Course } from '../course/build';
import type { CourseSpec } from '../course/types';
import type { NavigationParams } from '../params';

/** Built courses one thread keeps. A generation runs a few, ghosts and the Sandbox one more, so a handful is plenty. */
const KEEP = 12;

/**
 * Built courses by spec, newest last. Building one (its distance field
 * above all) takes a few milliseconds, and a worker meets the same specs
 * again and again: every batch of a generation, every ghost replay. The
 * key is the whole spec, so an edited course with an old id still builds
 * fresh.
 */
export class CourseCache {
  private readonly built = new Map<string, Course>();

  get(spec: CourseSpec, params: NavigationParams): Course {
    const key = `${JSON.stringify(spec)}|${params.agent.radius}`;
    const hit = this.built.get(key);
    if (hit) {
      this.built.delete(key);
      this.built.set(key, hit);
      return hit;
    }
    const course = buildCourse(spec, params);
    this.built.set(key, course);
    if (this.built.size > KEEP) this.built.delete(this.built.keys().next().value as string);
    return course;
  }
}
