import { DEFAULT_HIDESEEK_PHYSICS } from '../../../hideseek/physics';
import type { RegistryEntry } from '../types';
import { agent, ALL_TIERS, boolSensor, numSensor } from './sensor';

const ROOM_DIAGONAL = DEFAULT_HIDESEEK_PHYSICS.arena.size * Math.SQRT2;

/** Who sees whom: the core of the game, and what most rewards are built from. */
export const HIDESEEK_SIGHT_ENTRIES: RegistryEntry[] = [
  boolSensor(
    {
      name: 'agent.seesOpponent',
      unit: '',
      summary: 'True while this agent has the other player in sight.',
      description:
        'In sight means within 14 m, inside the 135 degree field of view and with no wall or box in between. Seekers see nothing during prep. For a seeker this is the goal of the game.',
      example: 'reward +1 * dt when agent.isSeeker and agent.seesOpponent',
      explain: 'the agent sees its opponent',
      label: 'sees opponent',
      presets: ALL_TIERS,
      progress: true,
    },
    (v) => agent(v).seesOpponent,
  ),
  boolSensor(
    {
      name: 'agent.seen',
      unit: '',
      summary: 'True while the seeker has the hider in sight.',
      description: 'The same value for both players: it is about the hider being seen, whichever team reads it. It is always false during prep.',
      example: 'reward -1 * dt when agent.isHider and agent.seen',
      explain: 'the hider is seen',
      label: 'hider seen',
      presets: ['intermediate', 'advanced'],
      progress: true,
    },
    (v) => agent(v).seen,
  ),
  boolSensor(
    {
      name: 'agent.hidden',
      unit: '',
      summary: 'True during the seek phase while the seeker cannot see the hider.',
      description:
        'The same value for both players. It is false during prep, so rewarding it only counts time after the seeker starts looking. For a hider this is the goal of the game.',
      example: 'reward +1 * dt when agent.isHider and agent.hidden',
      explain: 'the hider is hidden',
      label: 'hider hidden',
      presets: ALL_TIERS,
      progress: true,
    },
    (v) => agent(v).hidden,
  ),
  boolSensor(
    {
      name: 'agent.exposed',
      unit: '',
      summary: 'True while the seeker would see the hider just by turning to face it.',
      description:
        'The hider is within the seeker\'s 14 m vision range and no wall or box blocks the line between them. A hider can be hidden but exposed when the seeker simply looks the other way. Rewarding hiders for hidden and not exposed teaches real cover, even against a clumsy seeker.',
      example: 'reward +1 * dt when agent.isHider and agent.hidden and not agent.exposed',
      explain: 'the hider is exposed',
      label: 'hider exposed',
      presets: ['advanced'],
      progress: true,
    },
    (v) => agent(v).exposed,
  ),
  numSensor(
    {
      name: 'agent.opponentDistance',
      unit: 'm',
      range: [0, ROOM_DIAGONAL],
      summary: 'Straight line distance to the other player.',
      description:
        'Measured through walls, so it is known even when the other player is out of sight. It is a script value only, not a brain input, so rewarding it shapes behavior without telling the brain where the opponent is.',
      example: 'reward +0.05 * dt when agent.isSeeker and agent.opponentDistance < 5 m',
      explain: 'the distance to the opponent',
      label: 'distance to opponent',
      presets: ['advanced'],
    },
    (v) => agent(v).opponentDistance,
  ),
  numSensor(
    {
      name: 'agent.lastSeenAge',
      unit: 's',
      summary: 'Seconds since this agent last saw the other player.',
      description: 'Zero while the opponent is in sight, then counts up. Before the first sighting it reads a very large number, so a check like agent.lastSeenAge > 30 s means not seen yet.',
      example: 'reward -0.1 * dt when agent.isSeeker and agent.lastSeenAge > 5 s',
      explain: 'the time since the opponent was last seen',
      label: 'time since last sighting',
      presets: ['advanced'],
    },
    (v) => agent(v).lastSeenAge,
  ),
];
