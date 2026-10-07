import { DEFAULT_HIDESEEK_PHYSICS } from '../../../hideseek/physics';
import type { RegistryEntry } from '../types';
import { agent, boolSensor, numSensor } from './sensor';

const P = DEFAULT_HIDESEEK_PHYSICS;
const ROOM_DIAGONAL = P.arena.size * Math.SQRT2;
/** The highest an agent ever gets: the top of a vault's arc. */
const TOP = P.arena.wallHeight + P.climb.clearance;
/** A climb and a jump take a couple of seconds, so a match holds at most about this many vaults. */
const MOST_VAULTS = Math.ceil(P.matchSeconds / 2);

/** Ramps: climbing, jumping off the lip and vaulting walls. Both teams climb. */
export const HIDESEEK_RAMP_ENTRIES: RegistryEntry[] = [
  boolSensor(
    {
      name: 'agent.climbing',
      unit: '',
      summary: 'True while the agent is on the slope of a ramp.',
      description:
        'An agent at the foot of a ramp that drives forward facing uphill runs up it, and the move output takes it up or down the slope. On a ramp it cannot grab or lock, and nothing can push it.',
      example: 'reward +0.05 * dt when agent.isSeeker and agent.climbing',
      explain: 'the agent is on a ramp',
      label: 'on a ramp',
    },
    (v) => agent(v).climbing,
  ),
  boolSensor(
    {
      name: 'agent.airborne',
      unit: '',
      summary: 'True while the agent is in the air after running off the top of a ramp.',
      description: 'At the lip an agent jumps to the first free spot straight ahead, up to 3 m away. It cannot act until it lands half a second later.',
      example: 'reward +0.1 * dt when agent.isSeeker and agent.airborne',
      explain: 'the agent is in the air',
      label: 'in the air',
    },
    (v) => agent(v).airborne,
  ),
  numSensor(
    {
      name: 'agent.elevation',
      unit: 'm',
      range: [0, TOP],
      summary: "How high the agent's feet are above the floor.",
      description: 'It reads 0 on the floor, up to 1.2 m at the top of a ramp, and more in the middle of a jump. From 1 m up an agent sees over boxes and is seen over them, but never over walls.',
      example: 'reward +0.05 * dt when agent.isSeeker and agent.elevation > 1 m',
      explain: "the agent's height above the floor",
      label: 'elevation',
    },
    (v) => agent(v).elevation,
  ),
  numSensor(
    {
      name: 'agent.nearestRampDistance',
      unit: 'm',
      range: [0, ROOM_DIAGONAL],
      summary: 'Distance to the center of the closest ramp.',
      description: 'Every room has one ramp. A seeker that pushes it up to a wall can run up it and jump over the wall.',
      example: 'reward +0.05 * dt when agent.isSeeker and agent.nearestRampDistance < 2 m',
      explain: 'the distance to the nearest ramp',
      label: 'nearest ramp distance',
    },
    (v) => agent(v).nearestRampDistance,
  ),
  boolSensor(
    {
      name: 'agent.justVaulted',
      unit: '',
      summary: 'True on the tick the agent lands after jumping over a wall.',
      description: 'A jump off a ramp that crosses a wall is a vault. It is how a seeker gets into a shelter whose doorway the hiders have sealed.',
      example: 'reward +0.5 when agent.isSeeker and agent.justVaulted',
      explain: 'the agent lands after jumping a wall',
      label: 'just vaulted',
    },
    (v) => agent(v).justVaulted,
  ),
  numSensor(
    {
      name: 'agent.vaults',
      unit: '',
      range: [0, MOST_VAULTS],
      summary: 'How many walls the agent has jumped so far this match.',
      description: 'It counts every vault since the match began. Use it with justVaulted to reward the first vault more than the rest.',
      example: 'reward +0.5 when agent.isSeeker and agent.justVaulted and agent.vaults == 1',
      explain: 'the number of walls jumped',
      label: 'vaults',
    },
    (v) => agent(v).vaults,
  ),
];
