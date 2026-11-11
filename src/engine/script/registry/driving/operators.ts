import { MAX_BAR, MIN_BAR } from '../../../driving/curriculum';
import { BUILT_IN_CITIES } from '../../../driving/city/presets';
import { MAX_LEVEL, MIN_LEVEL } from '../../../driving/levels';
import { MAX_TRIPS, MIN_TRIPS, randomCityId } from '../../../driving/run/settings';
import { clampTo, entry, param, req } from '../define';
import { metricSensor, setEnvDirective } from '../envHelpers';
import type { Effect, EffectArgs, RegistryEntry } from '../types';

type OperatorDocs = Omit<Parameters<typeof entry>[0], 'kind' | 'scope' | 'env' | 'type' | 'unit' | 'binding'>;

/** A driving generation operator: it only writes a request, which the env module reads when it picks the next content. */
function operator(d: OperatorDocs, apply: (args: EffectArgs) => Effect): RegistryEntry {
  return entry({ ...d, kind: 'operator', scope: 'generation', env: 'driving', type: 'void', unit: '', binding: { kind: 'effect', apply } });
}

/** Generation block sensors and operators: what the generation did, and the city, level and trips of the next one. */
export const DRIVING_GENERATION_ENTRIES: RegistryEntry[] = [
  metricSensor({
    name: 'curriculum.level',
    env: 'driving',
    key: 'level',
    unit: '',
    range: [MIN_LEVEL, MAX_LEVEL],
    label: 'level',
    summary: 'The level the generation that just finished drove, from 1 to 5.',
    description: 'Level 1 is empty streets, 2 adds traffic lights, 3 people, 4 traffic and 5 rush hour. The automatic curriculum moves it up, and useLevel sets it.',
    example: 'if curriculum.level >= 3 {\n  routesPerGeneration(count: 3)\n}',
    explain: 'the current level',
  }),
  metricSensor({
    name: 'drives.arrived',
    env: 'driving',
    key: 'arrived',
    unit: '',
    range: [0, 1],
    label: 'share arrived',
    summary: 'Share of the last generation\'s trips that reached the destination.',
    description: 'Counted over every brain and every trip, from 0 to 1. A trip counts even if it broke a rule on the way.',
    example: 'if drives.arrived > 50% {\n  useLevel(level: 3)\n}',
    explain: 'the share of trips that arrived',
  }),
  metricSensor({
    name: 'drives.safe',
    env: 'driving',
    key: 'safe',
    unit: '',
    range: [0, 1],
    label: 'share arrived safely',
    summary: 'Share of the last generation\'s trips that arrived with no crash and no red light run.',
    description: 'Counted over every brain and every trip, from 0 to 1. The automatic curriculum moves up on this share.',
    example: 'if drives.safe < 5% {\n  select(top: 30%)\n}',
    explain: 'the share of trips that arrived safely',
  }),
  metricSensor({
    name: 'drives.crashed',
    env: 'driving',
    key: 'crashes',
    unit: '',
    range: [0, 1],
    label: 'share crashed',
    summary: 'Share of the last generation\'s trips that ended against another car.',
    description: 'Counted over every brain and every trip, from 0 to 1. Other cars drive from the fourth level on.',
    example: 'if drives.crashed > 30% {\n  routesPerGeneration(count: 3)\n}',
    explain: 'the share of trips that crashed',
  }),
  operator(
    {
      name: 'useLevel',
      params: [param('level', 'number', '', 'A level from 1 (empty streets) to 5 (rush hour).', { range: [MIN_LEVEL, MAX_LEVEL] })],
      summary: 'Drives the next generation at a fixed level and turns the automatic curriculum off.',
      description: 'Levels go from empty streets to rush hour. Setting one by hand holds it there until the script sets another or calls autoLevel.',
      example: 'if generation > 40 {\n  useLevel(level: 2)\n}',
      block: { category: 'environment', label: 'use level {level}' },
      explain: 'drive at level {level}',
    },
    (args) => {
      const level = req(args.num, 'level');
      return (v, io) => setEnvDirective(v, 'level', Math.round(clampTo(level(v, io), MIN_LEVEL, MAX_LEVEL)));
    },
  ),
  operator(
    {
      name: 'autoLevel',
      params: [param('share', 'number', '', 'Share of trips that must arrive safely, averaged over a few generations, such as 25%.', { range: [MIN_BAR, MAX_BAR] })],
      summary: 'Moves up a level on its own once enough trips arrive safely.',
      description: 'The curriculum judges the best fifth of the population by fitness and averages their safe share over a few generations, so one easy route never skips a level. It never moves back down. A run without a script uses a bar of 50%.',
      example: 'autoLevel(share: 30%)',
      block: { category: 'environment', label: 'level up at {share} safe' },
      explain: 'move up a level once {share} of trips arrive safely',
    },
    (args) => {
      const share = req(args.num, 'share');
      return (v, io) => setEnvDirective(v, 'autoLevel', clampTo(share(v, io), MIN_BAR, MAX_BAR));
    },
  ),
  operator(
    {
      name: 'routesPerGeneration',
      params: [param('count', 'number', '', `Trips each brain drives per generation, ${MIN_TRIPS} to ${MAX_TRIPS}.`, { range: [MIN_TRIPS, MAX_TRIPS] })],
      summary: 'Sets how many different trips each brain drives per generation.',
      description: 'Every brain drives the same trips, one after another, and its fitness adds up over them. More trips give a fairer score and a steadier curriculum, but each generation takes longer.',
      example: 'routesPerGeneration(count: 3)',
      block: { category: 'environment', label: 'drive {count} trips' },
      explain: 'drive {count} trips per generation',
    },
    (args) => {
      const count = req(args.num, 'count');
      return (v, io) => setEnvDirective(v, 'trips', Math.round(clampTo(count(v, io), MIN_TRIPS, MAX_TRIPS)));
    },
  ),
  operator(
    {
      name: 'useCity',
      params: [param('id', 'string', '', 'A built in city id.', { choices: BUILT_IN_CITIES.map((c) => c.id) })],
      summary: 'Drives the next generation in a built in city.',
      description: 'Midtown is where runs train by default. Harbor and Old Town have other block sizes and slow zones, so switching cities teaches brains streets they have never seen.',
      example: 'useCity(id: "harbor")',
      block: { category: 'environment', label: 'use city {id}' },
      explain: 'drive in {id}',
    },
    (args) => {
      const id = req(args.str, 'id');
      return (v) => setEnvDirective(v, 'city', id);
    },
  ),
  operator(
    {
      name: 'randomCity',
      params: [param('seed', 'number', '', 'Any whole number. The same seed always makes the same city.')],
      summary: 'Drives the next generation in a generated city.',
      description: 'Builds a city of four to six blocks a side from the seed. Using the generation number as the seed gives a new city every time.',
      example: 'randomCity(seed: generation)',
      block: { category: 'environment', label: 'random city {seed}' },
      explain: 'drive in random city {seed}',
    },
    (args) => {
      const seed = req(args.num, 'seed');
      return (v, io) => setEnvDirective(v, 'city', randomCityId(seed(v, io)));
    },
  ),
];
