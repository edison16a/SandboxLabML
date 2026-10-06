import { DEFAULT_HIDESEEK_PHYSICS } from '../../../hideseek/physics';
import type { RegistryEntry } from '../types';
import { agent, ALL_TIERS, boolSensor, numSensor } from './sensor';

const P = DEFAULT_HIDESEEK_PHYSICS;

/** Which team an agent plays for, how it moves and where the match clock stands. */
export const HIDESEEK_AGENT_ENTRIES: RegistryEntry[] = [
  boolSensor(
    {
      name: 'agent.isHider',
      unit: '',
      summary: 'True for hiders, false for seekers.',
      description:
        'One script trains both teams, and every line in each tick runs for hiders and seekers alike. Wrap the rewards of each team in if agent.isHider { } else { } so each team learns its own goal.',
      example: 'if agent.isHider {\n  reward +1 * dt when agent.hidden\n}',
      explain: 'the agent is a hider',
      label: 'is a hider',
      presets: ALL_TIERS,
    },
    (v) => agent(v).index === 0,
  ),
  boolSensor(
    {
      name: 'agent.isSeeker',
      unit: '',
      summary: 'True for seekers, false for hiders.',
      description: 'The opposite of agent.isHider. Use whichever reads better, such as if agent.isSeeker { } for rules that only apply to seekers.',
      example: 'reward +1 * dt when agent.isSeeker and agent.seesOpponent',
      explain: 'the agent is a seeker',
      label: 'is a seeker',
    },
    (v) => agent(v).index === 1,
  ),
  numSensor(
    {
      name: 'agent.speed',
      unit: 'm/s',
      range: [-P.agent.maxSpeed * P.agent.backwardShare, P.agent.maxSpeed],
      summary: 'How fast the agent is moving forward.',
      description: 'Forward speed in meters per second, negative when backing up. Agents top out at 3.5 m/s forward and half that in reverse.',
      example: 'reward +0.01 * dt * agent.speed / 1 m/s when agent.isSeeker',
      explain: "the agent's speed",
      label: 'speed',
    },
    (v) => agent(v).speed,
  ),
  boolSensor(
    {
      name: 'agent.prep',
      unit: '',
      summary: 'True during the prep phase at the start of each match.',
      description:
        'For the first part of every match the seeker is frozen and blind while the hider gets ready. Nothing in the built-in rewards scores during prep, so most scripts skip it too.',
      example: 'reward -1 * dt when agent.isSeeker and not agent.prep and not agent.seesOpponent',
      explain: 'it is the prep phase',
      label: 'prep phase',
      presets: ['intermediate', 'advanced'],
    },
    (v) => agent(v).prep,
  ),
  numSensor(
    {
      name: 'agent.time',
      unit: 's',
      range: [0, P.matchSeconds],
      summary: 'Seconds since the match started.',
      description: 'Counts up by one tick (1/30 s) every step, from 0 to the end of the 30 second match. The prep phase is part of it.',
      example: 'reward +0.5 * dt when agent.isHider and agent.hidden and agent.time > 20 s',
      explain: 'the time since the start',
      label: 'match time',
    },
    (v) => agent(v).time,
  ),
  numSensor(
    {
      name: 'agent.timeLeft',
      unit: 's',
      range: [0, P.matchSeconds],
      summary: 'Seconds until the match ends.',
      description: 'Counts down to 0 at the end of the match. Hiders that are still hidden near the end have done their job.',
      example: 'reward +1 * dt when agent.isHider and agent.hidden and agent.timeLeft < 5 s',
      explain: 'the time left',
      label: 'time left',
    },
    (v) => agent(v).timeLeft,
  ),
];
