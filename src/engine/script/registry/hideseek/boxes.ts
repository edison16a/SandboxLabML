import { BOX_COUNT, DEFAULT_HIDESEEK_PHYSICS } from '../../../hideseek/physics';
import type { RegistryEntry } from '../types';
import { agent, boolSensor, numSensor } from './sensor';

const ROOM_DIAGONAL = DEFAULT_HIDESEEK_PHYSICS.arena.size * Math.SQRT2;

/** Boxes: carrying, locking and the one-tick events that go with them. */
export const HIDESEEK_BOX_ENTRIES: RegistryEntry[] = [
  boolSensor(
    {
      name: 'agent.holding',
      unit: '',
      summary: 'True while the agent carries a box.',
      description: 'An agent picks up the nearest free box in front of it while its grab output is above zero, and drops it when the output falls. Both teams can carry boxes.',
      example: 'reward +0.1 * dt when agent.isHider and agent.holding and agent.prep',
      explain: 'the agent carries a box',
      label: 'holding a box',
    },
    (v) => agent(v).holding,
  ),
  numSensor(
    {
      name: 'agent.nearestBoxDistance',
      unit: 'm',
      range: [0, ROOM_DIAGONAL],
      summary: 'Distance to the center of the closest box.',
      description: 'Every room has four boxes: two cubes and two long planks. Boxes block sight, so a hider close to one has cover nearby.',
      example: 'reward +0.05 * dt when agent.isHider and agent.prep and agent.nearestBoxDistance < 2 m',
      explain: 'the distance to the nearest box',
      label: 'nearest box distance',
    },
    (v) => agent(v).nearestBoxDistance,
  ),
  numSensor(
    {
      name: 'agent.boxesLocked',
      unit: '',
      range: [0, BOX_COUNT],
      summary: 'How many boxes this agent\'s team has locked right now.',
      description:
        'Only hiders can lock boxes, so seekers always read 0. A locked box cannot be pushed or carried by anyone, which makes it the way to build a shelter that stays built.',
      example: 'reward +0.2 * dt * agent.boxesLocked when agent.isHider and agent.hidden',
      explain: 'the number of boxes locked by the team',
      label: 'boxes locked',
      presets: ['advanced'],
    },
    (v) => agent(v).boxesLockedByTeam,
  ),
  boolSensor(
    {
      name: 'agent.justGrabbed',
      unit: '',
      summary: 'True on the tick the agent picks up a box.',
      description: 'True for exactly one tick each time a grab succeeds. A small bonus here helps brand new brains discover that boxes can be moved at all.',
      example: 'reward +0.1 when agent.justGrabbed and agent.prep',
      explain: 'the agent picks up a box',
      label: 'just grabbed',
    },
    (v) => agent(v).justGrabbed,
  ),
  boolSensor(
    {
      name: 'agent.justReleased',
      unit: '',
      summary: 'True on the tick the agent drops a box.',
      description: 'True for exactly one tick whenever a carried box is let go, on purpose or because it got stuck. Locking a held box drops it too.',
      example: 'reward +0.05 when agent.justReleased and agent.prep',
      explain: 'the agent drops a box',
      label: 'just released',
    },
    (v) => agent(v).justReleased,
  ),
  boolSensor(
    {
      name: 'agent.justLocked',
      unit: '',
      summary: 'True on the tick a hider locks a box.',
      description: 'True for exactly one tick each time the lock output switches on in front of a free box. Only hiders can lock, so it never fires for seekers.',
      example: 'reward +0.2 when agent.justLocked and agent.prep',
      explain: 'the agent locks a box',
      label: 'just locked',
    },
    (v) => agent(v).justLocked,
  ),
  boolSensor(
    {
      name: 'agent.justUnlocked',
      unit: '',
      summary: 'True on the tick a hider unlocks a box.',
      description: 'Pressing lock again in front of a box the team locked frees it. A small penalty stops hiders from flicking locks on and off.',
      example: 'reward -0.2 when agent.justUnlocked',
      explain: 'the agent unlocks a box',
      label: 'just unlocked',
    },
    (v) => agent(v).justUnlocked,
  ),
];
