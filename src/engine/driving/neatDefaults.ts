import { DEFAULT_MUTATION, type NeatConfig } from '../neat/config';

/**
 * NEAT settings a Driving run starts from. Gentler weight changes than the
 * textbook defaults: a direct wired driving brain has fifty or so weights
 * that must all stay roughly right at once, and replacing one in ten per
 * mutation broke most children of a good driver. With these, three seeds
 * out of three reach the second level within about sixty generations (see
 * scripts/driving/curriculum.test.ts).
 */
export const DRIVING_NEAT: Partial<NeatConfig> = {
  mutation: { ...DEFAULT_MUTATION, replaceWeight: 0.02, weightPower: 0.3 },
};
